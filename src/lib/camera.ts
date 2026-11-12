// Camera maths shared by the browser viewer (Three.js) and the server-side
// software rasteriser, so admin previews match what players see exactly.
import type { CameraPose } from './types';

export const FOV_DEG = 28;
export const MARGIN = 1.12; // breathing room around the bounding sphere

const RAD = Math.PI / 180;

/** Distance from the origin at which a unit bounding sphere fits the view. */
export function cameraDistance(zoom = 1): number {
  return (MARGIN / Math.sin((FOV_DEG / 2) * RAD)) / Math.max(zoom, 0.05);
}

/** Camera position for a pose, looking at the origin with +Y up. */
export function cameraPosition(pose: Pick<CameraPose, 'az' | 'el' | 'zoom'>): [number, number, number] {
  const d = cameraDistance(pose.zoom);
  const el = clamp(pose.el, -89, 89) * RAD;
  const az = pose.az * RAD;
  return [d * Math.cos(el) * Math.sin(az), d * Math.sin(el), d * Math.cos(el) * Math.cos(az)];
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function normaliseAz(az: number): number {
  let a = az % 360;
  if (a > 180) a -= 360;
  if (a < -180) a += 360;
  return a;
}
