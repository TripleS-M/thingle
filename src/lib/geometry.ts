// Server-side model reading: GLB / GLTF via glTF-Transform, OBJ / STL via small
// built-in parsers. Produces a normalised triangle soup for validation, stats
// and preview rendering, plus a self-contained GLB when conversion is needed.
import fs from 'node:fs';
import path from 'node:path';
import { Document, NodeIO, type Node as GNode } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

export const SUPPORTED_FORMATS = ['glb', 'gltf', 'obj', 'stl'];

export interface Geo {
  positions: Float32Array; // 9 floats per triangle; centred, bounding radius 1
  colors: Float32Array;    // 3 floats per triangle (sRGB 0..1)
  triangles: number;
  vertices: number;
  size: [number, number, number]; // original bounding-box dimensions
}

export interface LoadedModel {
  geo: Geo;
  /** Self-contained GLB to serve instead of the source file (non-GLB sources). */
  glb: Uint8Array | null;
}

let ioPromise: Promise<NodeIO> | null = null;
function getIO(): Promise<NodeIO> {
  ioPromise ??= (async () => {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const deps: Record<string, unknown> = {};
    try { deps['meshopt.decoder'] = (await import('meshoptimizer')).MeshoptDecoder; } catch { /* optional */ }
    try {
      const draco = (await import('draco3dgltf')).default;
      deps['draco3d.decoder'] = await draco.createDecoderModule();
    } catch { /* optional */ }
    return io.registerDependencies(deps);
  })();
  return ioPromise;
}

const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

class Soup {
  pos: number[] = [];
  col: number[] = [];
  vertices = 0;
  tri(a: number[], b: number[], c: number[], rgb: number[]) {
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.col.push(rgb[0], rgb[1], rgb[2]);
  }
  finish(): Geo {
    const n = this.pos.length / 9;
    if (n === 0) throw new Error('Model contains no triangles');
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < this.pos.length; i++) {
      const v = this.pos[i], k = i % 3;
      if (!Number.isFinite(v)) throw new Error('Model contains invalid vertex data');
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
    const c = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    let r2 = 0;
    for (let i = 0; i < this.pos.length; i += 3) {
      const dx = this.pos[i] - c[0], dy = this.pos[i + 1] - c[1], dz = this.pos[i + 2] - c[2];
      r2 = Math.max(r2, dx * dx + dy * dy + dz * dz);
    }
    const r = Math.sqrt(r2) || 1;
    const positions = new Float32Array(this.pos.length);
    for (let i = 0; i < this.pos.length; i++) positions[i] = (this.pos[i] - c[i % 3]) / r;
    return {
      positions, colors: new Float32Array(this.col), triangles: n, vertices: this.vertices,
      size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
    };
  }
}

function applyMat(m: ArrayLike<number>, p: number[]): number[] {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

function soupFromDocument(doc: Document): Geo {
  const soup = new Soup();
  const root = doc.getRoot();
  const scenes = root.getDefaultScene() ? [root.getDefaultScene()!] : root.listScenes();
  const visit = (node: GNode) => {
    const mesh = node.getMesh();
    if (!mesh) return;
    const world = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const mode = prim.getMode();
      const posAcc = prim.getAttribute('POSITION');
      if (!posAcc || mode < 4) continue; // points and lines are never part of a silhouette
      const count = posAcc.getCount();
      const pts: number[][] = new Array(count);
      for (let i = 0; i < count; i++) pts[i] = applyMat(world, posAcc.getElement(i, [0, 0, 0]));
      soup.vertices += count;
      const f = prim.getMaterial()?.getBaseColorFactor() ?? [0.7, 0.7, 0.7, 1];
      const rgb = [toSrgb(f[0]), toSrgb(f[1]), toSrgb(f[2])];
      const idx = prim.getIndices();
      const n = idx ? idx.getCount() : count;
      const at = (i: number) => pts[idx ? idx.getScalar(i) : i];
      if (mode === 4) for (let i = 0; i + 2 < n; i += 3) soup.tri(at(i), at(i + 1), at(i + 2), rgb);
      else if (mode === 5) for (let i = 0; i + 2 < n; i++) soup.tri(at(i), at(i + 1), at(i + 2), rgb);
      else if (mode === 6) for (let i = 1; i + 1 < n; i++) soup.tri(at(0), at(i), at(i + 1), rgb);
    }
  };
  for (const scene of scenes) scene.traverse(visit);
  return soup.finish();
}

function parseObj(text: string): number[] {
  const v: number[][] = [];
  const out: number[] = [];
  for (const line of text.split('\n')) {
    const p = line.trim().split(/\s+/);
    if (p[0] === 'v') v.push([+p[1], +p[2], +p[3]]);
    else if (p[0] === 'f') {
      const ids = p.slice(1).map((s) => { const i = parseInt(s, 10); return i < 0 ? v.length + i : i - 1; });
      for (let i = 1; i + 1 < ids.length; i++) {
        for (const id of [ids[0], ids[i], ids[i + 1]]) { const q = v[id]; if (!q) throw new Error('OBJ face references a missing vertex'); out.push(q[0], q[1], q[2]); }
      }
    }
  }
  return out;
}

function parseStl(buf: Buffer): number[] {
  const out: number[] = [];
  const n = buf.length >= 84 ? buf.readUInt32LE(80) : 0;
  if (buf.length >= 84 && buf.length === 84 + n * 50) { // binary STL
    for (let i = 0; i < n; i++) {
      const o = 84 + i * 50 + 12;
      for (let k = 0; k < 9; k++) out.push(buf.readFloatLE(o + k * 4));
    }
    return out;
  }
  const re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/g;
  const text = buf.toString('utf8');
  for (let m = re.exec(text); m; m = re.exec(text)) out.push(+m[1], +m[2], +m[3]);
  return out;
}

/** Wrap a raw triangle list in a minimal glTF document with flat normals. */
function documentFromTriangles(flat: number[]): Document {
  if (flat.length < 9) throw new Error('Model contains no triangles');
  const doc = new Document();
  const buffer = doc.createBuffer();
  const pos = new Float32Array(flat);
  const nor = new Float32Array(flat.length);
  for (let i = 0; i < pos.length; i += 9) {
    const ux = pos[i + 3] - pos[i], uy = pos[i + 4] - pos[i + 1], uz = pos[i + 5] - pos[i + 2];
    const vx = pos[i + 6] - pos[i], vy = pos[i + 7] - pos[i + 1], vz = pos[i + 8] - pos[i + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (let k = 0; k < 9; k += 3) { nor[i + k] = nx; nor[i + k + 1] = ny; nor[i + k + 2] = nz; }
  }
  const material = doc.createMaterial('default').setBaseColorFactor([0.6, 0.6, 0.62, 1]).setRoughnessFactor(0.6).setMetallicFactor(0.2);
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(nor).setBuffer(buffer))
    .setMaterial(material);
  doc.createScene().addChild(doc.createNode().setMesh(doc.createMesh().addPrimitive(prim)));
  return doc;
}

export async function loadModel(absPath: string): Promise<LoadedModel> {
  const format = path.extname(absPath).slice(1).toLowerCase();
  const io = await getIO();
  if (format === 'glb') return { geo: soupFromDocument(await io.read(absPath)), glb: null };
  if (format === 'gltf') {
    const doc = await io.read(absPath); // resolves external .bin and textures
    const geo = soupFromDocument(doc);
    // Re-pack uncompressed so no encoder is needed and the result is one file.
    for (const ext of doc.getRoot().listExtensionsUsed()) {
      if (/draco|meshopt/i.test(ext.extensionName)) ext.dispose();
    }
    return { geo, glb: await io.writeBinary(doc) };
  }
  if (format === 'obj' || format === 'stl') {
    const buf = fs.readFileSync(absPath);
    const doc = documentFromTriangles(format === 'obj' ? parseObj(buf.toString('utf8')) : parseStl(buf));
    return { geo: soupFromDocument(doc), glb: await io.writeBinary(doc) };
  }
  throw new Error(`Unsupported format .${format}`);
}
