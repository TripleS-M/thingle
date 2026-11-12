// Asset ingestion: scan the library folder, validate new models, generate
// thumbnails + silhouette previews, and register them in an unpublished
// "review" state. Nothing here ever publishes a model.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, PATHS } from './db';
import { getAsset, modelPath, sanitiseMeta } from './assets';
import { loadModel, SUPPORTED_FORMATS, type Geo } from './geometry';
import { encodePng, render } from './raster';
import { PREVIEW_POSES } from './camera';
import { CATEGORIES, emptyMeta, type Asset, type AssetStats, type CameraPose } from './types';

export interface ScanReport {
  added: { id: string; file: string }[];
  duplicates: { file: string; duplicateOf: string }[];
  errors: { file: string; error: string }[];
  moved: number;
  missing: number;
  total: number;
}


function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (SUPPORTED_FORMATS.includes(path.extname(entry.name).slice(1).toLowerCase())) out.push(full);
  }
  return out;
}

const rel = (abs: string) => path.relative(PATHS.library, abs).split(path.sep).join('/');
const sha256 = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function categoryFromFolder(file: string): string {
  const folder = file.includes('/') ? file.split('/')[0].toLowerCase() : '';
  return CATEGORIES.find((c) => c.toLowerCase() === folder || c.toLowerCase().split(' ')[0] === folder) ?? '';
}

function titleFromFile(file: string): string {
  const base = path.basename(file).replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Silhouette coverage over a grid of angles — powers the "too revealing" check. */
function exposureRange(geo: Geo): { minArea: number; maxArea: number } {
  let minArea = Infinity, maxArea = 0;
  for (const el of [-60, -30, 0, 30, 60]) {
    for (let az = 0; az < 360; az += 30) {
      const { coverage } = render(geo, { pose: { az, el, roll: 0, zoom: 1 }, size: 72, mode: 'silhouette', supersample: 1 });
      minArea = Math.min(minArea, coverage); maxArea = Math.max(maxArea, coverage);
    }
  }
  return { minArea, maxArea };
}

function writePreviews(id: string, geo: Geo): void {
  const thumb = render(geo, { pose: PREVIEW_POSES[0], size: 384, mode: 'shaded' });
  fs.writeFileSync(path.join(PATHS.thumbnails, `${id}.png`), encodePng(thumb.rgba, 384, 384));
  PREVIEW_POSES.forEach((pose, i) => {
    const img = render(geo, { pose, size: 256, mode: 'silhouette' });
    fs.writeFileSync(path.join(PATHS.previews, `${id}-${i}.png`), encodePng(img.rgba, 256, 256));
  });
}

async function register(abs: string, hash: string): Promise<string> {
  const file = rel(abs);
  const format = path.extname(abs).slice(1).toLowerCase();
  const { geo, glb } = await loadModel(abs); // throws if the model is invalid
  const id = hash.slice(0, 12);
  if (glb) fs.writeFileSync(path.join(PATHS.processed, `${id}.glb`), glb);
  writePreviews(id, geo);

  // Optional sidecar: "model.meta.json" next to "model.glb" pre-fills metadata.
  let meta = emptyMeta();
  meta.displayName = titleFromFile(file);
  meta.category = categoryFromFolder(file);
  meta.hint1 = meta.category;
  const sidecar = abs.replace(/\.[^.]+$/, '.meta.json');
  if (fs.existsSync(sidecar)) {
    try { meta = sanitiseMeta(JSON.parse(fs.readFileSync(sidecar, 'utf8')), meta); }
    catch (e) { console.warn(`[shadowplay] ignoring invalid sidecar ${rel(sidecar)}: ${(e as Error).message}`); }
  }
  const st = fs.statSync(abs);
  const stats: AssetStats & { mtime: number } = {
    triangles: geo.triangles, vertices: geo.vertices, size: geo.size, bytes: st.size, mtime: st.mtimeMs,
    ...exposureRange(geo),
  };
  db().prepare(`INSERT INTO assets (id, hash, file, format, status, meta, stats, date_added)
    VALUES (?, ?, ?, ?, 'review', ?, ?, ?)`)
    .run(id, hash, file, format, JSON.stringify(meta), JSON.stringify(stats), new Date().toISOString());
  return id;
}

let scanning: Promise<ScanReport> | null = null;

/** Scan the asset library. Safe to call repeatedly; concurrent calls share one run. */
export function scanLibrary(): Promise<ScanReport> {
  scanning ??= doScan().finally(() => { scanning = null; });
  return scanning;
}

async function doScan(): Promise<ScanReport> {
  const report: ScanReport = { added: [], duplicates: [], errors: [], moved: 0, missing: 0, total: 0 };
  const conn = db();
  type Row = { id: string; hash: string; file: string; stats: string };
  const known = conn.prepare('SELECT id, hash, file, stats FROM assets').all() as unknown as Row[];
  const byFile = new Map(known.map((r) => [r.file, r]));
  const byHash = new Map(known.map((r) => [r.hash, r]));
  const present = new Map<string, string>(); // file -> hash for everything on disk

  for (const abs of walk(PATHS.library)) {
    const file = rel(abs);
    try {
      const st = fs.statSync(abs);
      const prev = byFile.get(file);
      const prevStats = prev ? (JSON.parse(prev.stats) as { bytes: number; mtime?: number }) : null;
      // Unchanged file (same path, size and mtime): skip re-hashing.
      const hash = prev && prevStats && prevStats.bytes === st.size && prevStats.mtime === st.mtimeMs ? prev.hash : sha256(abs);
      const owner = byHash.get(hash);
      if (!owner) {
        const id = await register(abs, hash);
        byHash.set(hash, { id, hash, file, stats: '{}' });
        report.added.push({ id, file });
        present.set(file, hash);
      } else if (owner.file === file) {
        present.set(file, hash);
      } else if (present.get(owner.file) === hash || fs.existsSync(path.join(PATHS.library, owner.file))) {
        report.duplicates.push({ file, duplicateOf: owner.file }); // same bytes already registered elsewhere
      } else {
        conn.prepare('UPDATE assets SET file = ? WHERE id = ?').run(file, owner.id); // file was moved / renamed
        owner.file = file;
        present.set(file, hash);
        report.moved++;
      }
    } catch (e) {
      report.errors.push({ file, error: (e as Error).message });
    }
  }

  const all = conn.prepare('SELECT id, hash, file FROM assets').all() as unknown as Row[];
  for (const row of all) {
    const gone = present.get(row.file) !== row.hash;
    if (gone) report.missing++;
    conn.prepare('UPDATE assets SET file_missing = ? WHERE id = ?').run(gone ? 1 : 0, row.id);
  }
  report.total = all.length;
  return report;
}

// Small in-memory cache so the admin angle checker doesn't re-parse models.
const geoCache = new Map<string, Geo>();
export async function assetGeo(asset: Asset): Promise<Geo> {
  let geo = geoCache.get(asset.id);
  if (!geo) {
    geo = (await loadModel(modelPath(asset))).geo;
    geoCache.set(asset.id, geo);
    if (geoCache.size > 6) geoCache.delete(geoCache.keys().next().value!);
  }
  return geo;
}

/** How revealing a pose is: 0 = the object's slimmest profile, 1 = its broadest. */
export async function exposureAt(asset: Asset, pose: CameraPose): Promise<{ coverage: number; exposure: number }> {
  const geo = await assetGeo(asset);
  const { coverage } = render(geo, { pose: { ...pose, zoom: 1 }, size: 72, mode: 'silhouette', supersample: 1 });
  const { minArea, maxArea } = asset.stats;
  const exposure = maxArea > minArea ? Math.min(1, Math.max(0, (coverage - minArea) / (maxArea - minArea))) : 0.5;
  return { coverage, exposure };
}

/** Save an uploaded model into the library folder (never overwrites). */
export function saveUpload(name: string, category: string, data: Buffer): string {
  const ext = path.extname(name).slice(1).toLowerCase();
  if (!SUPPORTED_FORMATS.includes(ext)) throw new Error(`Unsupported format .${ext}. Use ${SUPPORTED_FORMATS.join(', ')}.`);
  if (ext === 'gltf' && /"uri"\s*:\s*"(?!data:)/.test(data.toString('utf8'))) {
    throw new Error('This .gltf references external files. Upload a .glb, or copy the whole folder into the asset library and scan.');
  }
  const folder = (category || 'random').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'random';
  const base = path.basename(name, path.extname(name)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'model';
  const dir = path.join(/*turbopackIgnore: true*/ PATHS.library, folder);
  fs.mkdirSync(dir, { recursive: true });
  let target = path.join(/*turbopackIgnore: true*/ dir, `${base}.${ext}`);
  for (let i = 2; fs.existsSync(target); i++) target = path.join(/*turbopackIgnore: true*/ dir, `${base}-${i}.${ext}`);
  fs.writeFileSync(target, data);
  return target;
}

export { getAsset };
