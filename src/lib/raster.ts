// A tiny software rasteriser. A silhouette is just filled projected triangles,
// so previews and thumbnails are rendered in pure JS — no GPU or headless
// browser needed on the server. Uses the same camera maths as the web viewer.
import zlib from 'node:zlib';
import { cameraPosition, FOV_DEG } from './camera';
import type { CameraPose } from './types';
import type { Geo } from './geometry';

export interface RenderOptions {
  pose: CameraPose;
  size: number;
  mode: 'silhouette' | 'shaded';
  background?: [number, number, number];
  supersample?: number;
}

export interface RenderResult {
  rgba: Uint8Array;
  size: number;
  coverage: number; // fraction of the frame covered by the object
}

export function render(geo: Geo, opts: RenderOptions): RenderResult {
  const ss = opts.supersample ?? 2;
  const S = opts.size * ss;
  const shaded = opts.mode === 'shaded';
  const bg = opts.background ?? (shaded ? [36, 27, 18] : [233, 227, 211]);

  const pos = cameraPosition(opts.pose);
  const d = Math.hypot(pos[0], pos[1], pos[2]);
  const f = [-pos[0] / d, -pos[1] / d, -pos[2] / d];
  // right = f x up(0,1,0), up = right x f
  let r = [-f[2], 0, f[0]];
  const rl = Math.hypot(r[0], r[2]) || 1; r = [r[0] / rl, 0, r[2] / rl];
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const roll = (opts.pose.roll * Math.PI) / 180, cr = Math.cos(roll), sr = Math.sin(roll);
  const R = [r[0] * cr + u[0] * sr, r[1] * cr + u[1] * sr, r[2] * cr + u[2] * sr];
  const U = [-r[0] * sr + u[0] * cr, -r[1] * sr + u[1] * cr, -r[2] * sr + u[2] * cr];
  const k = 1 / Math.tan((FOV_DEG * Math.PI) / 360);
  const light = normalise([-0.45, 0.7, 0.55]); // in view space: upper left, towards camera

  const mask = new Uint8Array(S * S);
  const depth = shaded ? new Float32Array(S * S).fill(Infinity) : null;
  const rgb = shaded ? new Uint8Array(S * S * 3) : null;
  const P = geo.positions;
  const sx = [0, 0, 0], sy = [0, 0, 0], sz = [0, 0, 0], vx = [0, 0, 0], vy = [0, 0, 0];

  for (let t = 0; t < geo.triangles; t++) {
    let behind = false;
    for (let v = 0; v < 3; v++) {
      const o = t * 9 + v * 3, x = P[o], y = P[o + 1], z = P[o + 2];
      const zv = x * f[0] + y * f[1] + z * f[2] + d;
      if (zv < 0.05) { behind = true; break; }
      vx[v] = x * R[0] + y * R[1] + z * R[2];
      vy[v] = x * U[0] + y * U[1] + z * U[2];
      sx[v] = ((vx[v] * k) / zv * 0.5 + 0.5) * S;
      sy[v] = (0.5 - (vy[v] * k) / zv * 0.5) * S;
      sz[v] = zv;
    }
    if (behind) continue;
    const area = (sx[1] - sx[0]) * (sy[2] - sy[0]) - (sx[2] - sx[0]) * (sy[1] - sy[0]);
    if (area === 0) continue;
    const x0 = Math.max(0, Math.floor(Math.min(sx[0], sx[1], sx[2])));
    const x1 = Math.min(S - 1, Math.ceil(Math.max(sx[0], sx[1], sx[2])));
    const y0 = Math.max(0, Math.floor(Math.min(sy[0], sy[1], sy[2])));
    const y1 = Math.min(S - 1, Math.ceil(Math.max(sy[0], sy[1], sy[2])));
    if (x0 > x1 || y0 > y1) continue;

    let cr8 = 0, cg8 = 0, cb8 = 0;
    if (shaded) {
      // Flat shading from the view-space face normal (two-sided).
      const ax = vx[1] - vx[0], ay = vy[1] - vy[0], az = sz[0] - sz[1];
      const bx = vx[2] - vx[0], by = vy[2] - vy[0], bz = sz[0] - sz[2];
      const n = normalise([ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx]);
      const lam = Math.abs(n[0] * light[0] + n[1] * light[1] + n[2] * light[2]);
      const shade = 0.3 + 0.75 * lam;
      cr8 = Math.min(255, geo.colors[t * 3] * shade * 255);
      cg8 = Math.min(255, geo.colors[t * 3 + 1] * shade * 255);
      cb8 = Math.min(255, geo.colors[t * 3 + 2] * shade * 255);
    }
    const inv = 1 / area;
    for (let y = y0; y <= y1; y++) {
      const py = y + 0.5;
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5;
        const w0 = ((sx[1] - px) * (sy[2] - py) - (sx[2] - px) * (sy[1] - py)) * inv;
        const w1 = ((sx[2] - px) * (sy[0] - py) - (sx[0] - px) * (sy[2] - py)) * inv;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const i = y * S + x;
        if (depth && rgb) {
          const z = w0 * sz[0] + w1 * sz[1] + w2 * sz[2];
          if (z >= depth[i]) continue;
          depth[i] = z;
          rgb[i * 3] = cr8; rgb[i * 3 + 1] = cg8; rgb[i * 3 + 2] = cb8;
        }
        mask[i] = 1;
      }
    }
  }

  // Box-filter downsample for clean anti-aliased edges.
  const size = opts.size, out = new Uint8Array(size * size * 4), n = ss * ss;
  let covered = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hit = 0, cr2 = 0, cg2 = 0, cb2 = 0;
      for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) {
        const q = (y * ss + j) * S + x * ss + i;
        if (mask[q]) { hit++; if (rgb) { cr2 += rgb[q * 3]; cg2 += rgb[q * 3 + 1]; cb2 += rgb[q * 3 + 2]; } }
      }
      covered += hit;
      const a = hit / n, o = (y * size + x) * 4;
      out[o] = bg[0] * (1 - a) + (rgb ? cr2 / n : 0);
      out[o + 1] = bg[1] * (1 - a) + (rgb ? cg2 / n : 0);
      out[o + 2] = bg[2] * (1 - a) + (rgb ? cb2 / n : 0);
      out[o + 3] = 255;
    }
  }
  return { rgba: out, size, coverage: covered / (S * S) };
}

function normalise(v: number[]): number[] {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

export function encodePng(rgba: Uint8Array, width: number, height: number): Buffer {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(8); head.writeUInt32BE(data.length, 0); head.write(type, 4, 'ascii');
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
    return Buffer.concat([head, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}
