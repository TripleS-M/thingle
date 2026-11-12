// Asset registry: CRUD over the `assets` table plus metadata validation.
import fs from 'node:fs';
import path from 'node:path';
import { db, PATHS, today } from './db';
import { clamp, normaliseAz } from './camera';
import {
  DIFFICULTIES, emptyMeta, isLightBackground, type Asset, type AssetMeta, type AssetStats, type AssetStatus,
} from './types';

interface Row {
  id: string; hash: string; file: string; format: string; status: AssetStatus;
  meta: string; stats: string; date_added: string; date_last_used: string | null; file_missing: number;
}

const REQUIRED: [keyof AssetMeta, string][] = [
  ['displayName', 'display name'], ['answer', 'correct answer'], ['category', 'category'],
  ['hint1', 'category hint'], ['hint2', 'function hint'], ['licence', 'licence'],
];

export function missingFields(meta: AssetMeta): string[] {
  return REQUIRED.filter(([k]) => !String(meta[k] ?? '').trim()).map(([, label]) => label);
}

function scheduleMap(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const rows = db().prepare('SELECT date, asset_id FROM schedule ORDER BY date').all() as { date: string; asset_id: string }[];
  for (const r of rows) map.set(r.asset_id, [...(map.get(r.asset_id) ?? []), r.date]);
  return map;
}

function toAsset(row: Row, sched: Map<string, string[]>): Asset {
  const meta = { ...emptyMeta(), ...(JSON.parse(row.meta) as Partial<AssetMeta>) };
  return {
    id: row.id, hash: row.hash, file: row.file, format: row.format, status: row.status,
    meta, stats: JSON.parse(row.stats) as AssetStats,
    dateAdded: row.date_added, dateLastUsed: row.date_last_used, fileMissing: !!row.file_missing,
    missing: missingFields(meta), scheduled: sched.get(row.id) ?? [],
  };
}

export function listAssets(): Asset[] {
  const sched = scheduleMap();
  return (db().prepare('SELECT * FROM assets ORDER BY date_added DESC, id').all() as unknown as Row[]).map((r) => toAsset(r, sched));
}

export function getAsset(id: string): Asset | null {
  const row = db().prepare('SELECT * FROM assets WHERE id = ?').get(id) as unknown as Row | undefined;
  return row ? toAsset(row, scheduleMap()) : null;
}

/** Absolute path of the GLB the browser should load for this asset. */
export function modelPath(asset: Pick<Asset, 'id' | 'file' | 'format'>): string {
  return asset.format === 'glb' ? path.join(PATHS.library, asset.file) : path.join(PATHS.processed, `${asset.id}.glb`);
}

const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown, fallback: number) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

/** Merge untrusted input over existing metadata, coercing every field. */
export function sanitiseMeta(input: Record<string, unknown>, base: AssetMeta): AssetMeta {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(input, k);
  const out: AssetMeta = structuredClone(base);
  for (const k of ['displayName', 'answer', 'category', 'subcategory', 'description', 'hint1', 'hint2',
    'sourceSite', 'sourceUrl', 'creator', 'licence', 'attribution'] as const) {
    if (has(k)) out[k] = str(input[k]);
  }
  if (has('accepted') && Array.isArray(input.accepted)) {
    out.accepted = [...new Set(input.accepted.map((a) => str(a, 120)).filter(Boolean))].slice(0, 60);
  }
  if (has('difficulty') && DIFFICULTIES.includes(input.difficulty as never)) out.difficulty = input.difficulty as AssetMeta['difficulty'];
  if (has('shadow')) out.shadow = !!input.shadow;
  if (has('background')) out.background = isLightBackground(str(input.background)) ? str(input.background).toLowerCase() : '';
  if (has('rotation') && input.rotation && typeof input.rotation === 'object') {
    const r = input.rotation as Record<string, unknown>;
    out.rotation = { h: clamp(num(r.h, base.rotation.h), 0, 180), v: clamp(num(r.v, base.rotation.v), 0, 89) };
  }
  if (has('camera') && input.camera && typeof input.camera === 'object') {
    const c = input.camera as Record<string, unknown>;
    out.camera = {
      az: normaliseAz(num(c.az, base.camera.az)), el: clamp(num(c.el, base.camera.el), -89, 89),
      roll: clamp(num(c.roll, base.camera.roll), -180, 180), zoom: clamp(num(c.zoom, base.camera.zoom), 0.4, 3),
    };
  }
  return out;
}

export function updateAsset(id: string, patch: { meta?: Record<string, unknown>; status?: AssetStatus }): Asset {
  const asset = getAsset(id);
  if (!asset) throw new Error('Asset not found');
  const meta = patch.meta ? sanitiseMeta(patch.meta, asset.meta) : asset.meta;
  let status = asset.status;
  if (patch.status && patch.status !== asset.status) {
    if (!['review', 'approved', 'rejected', 'archived'].includes(patch.status)) throw new Error('Invalid status');
    if (patch.status === 'approved') {
      const missing = missingFields(meta);
      if (missing.length) throw new Error(`Cannot approve — still needs: ${missing.join(', ')}`);
      if (asset.fileMissing) throw new Error('Cannot approve — the model file is missing from the asset folder');
    }
    status = patch.status;
  }
  db().prepare('UPDATE assets SET meta = ?, status = ? WHERE id = ?').run(JSON.stringify(meta), status, id);
  if (status !== 'approved') {
    // Unapproved models are never published: pull upcoming slots back to draft.
    // Puzzles that have already run stay in the archive.
    db().prepare("UPDATE schedule SET status = 'draft' WHERE asset_id = ? AND date > ?").run(id, today());
  }
  return getAsset(id)!;
}

export function deleteAsset(id: string, removeFile: boolean): void {
  const asset = getAsset(id);
  if (!asset) return;
  const ran = db().prepare("SELECT 1 FROM schedule WHERE asset_id = ? AND status = 'scheduled' AND date <= ? LIMIT 1").get(id, today());
  if (ran) throw new Error('This model has already run as a daily case. Archive it instead, so the case archive and player records stay intact.');
  db().prepare('DELETE FROM schedule WHERE asset_id = ?').run(id);
  db().prepare('DELETE FROM assets WHERE id = ?').run(id);
  const junk = [path.join(PATHS.thumbnails, `${id}.png`), path.join(PATHS.processed, `${id}.glb`)];
  for (let i = 0; i < 4; i++) junk.push(path.join(PATHS.previews, `${id}-${i}.png`));
  if (removeFile) {
    const src = path.join(PATHS.library, asset.file);
    junk.push(src, src.replace(/\.[^.]+$/, '.meta.json'));
  }
  for (const f of junk) fs.rmSync(f, { force: true });
}
