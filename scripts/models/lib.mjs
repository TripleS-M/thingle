// Helpers for the procedural sample-model generator. Models are built with
// Three.js geometry and written as GLB with glTF-Transform (no browser needed).
import * as T from 'three';
import { Document, NodeIO } from '@gltf-transform/core';

export { T };

export const mat = (color, metal = 0.3, rough = 0.6, opacity = 1) =>
  new T.MeshStandardMaterial({ color, metalness: metal, roughness: rough, opacity, transparent: opacity < 1 });

/** Add a mesh to a group: add(group, geometry, material, position?, rotation?, scale?) */
export function add(g, geo, material, p = [0, 0, 0], r = [0, 0, 0], s = null) {
  const m = new T.Mesh(geo, material);
  m.position.set(...p); m.rotation.set(...r);
  if (s) m.scale.set(...s);
  g.add(m);
  return m;
}

/** A cylinder of radius r running from point a to point b. */
export function rod(g, a, b, r, material, seg = 12) {
  const va = new T.Vector3(...a), vb = new T.Vector3(...b), dir = vb.clone().sub(va);
  const m = new T.Mesh(new T.CylinderGeometry(r, r, dir.length(), seg), material);
  m.position.copy(va).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.clone().normalize());
  g.add(m);
  return m;
}

export const box = (w, h, d) => new T.BoxGeometry(w, h, d);
export const cyl = (rt, rb, h, seg = 40, open = false) => new T.CylinderGeometry(rt, rb, h, seg, 1, open);
export const sph = (r, seg = 32) => new T.SphereGeometry(r, seg, Math.round(seg * 0.6));
export const tor = (R, r, seg = 64, tube = 16) => new T.TorusGeometry(R, r, tube, seg);
/** Solid of revolution around Y from [radius, y] pairs. */
export const lathe = (pts, seg = 48) => new T.LatheGeometry(pts.map(([x, y]) => new T.Vector2(x, y)), seg);
/** Extrude a 2D outline ([x, y] pairs) along Z, centred on Z. */
export function extrude(pts, depth, holes = []) {
  const shape = pts instanceof T.Shape ? pts : new T.Shape(pts.map(([x, y]) => new T.Vector2(x, y)));
  for (const h of holes) shape.holes.push(new T.Path(h.map(([x, y]) => new T.Vector2(x, y))));
  const geo = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 });
  geo.translate(0, 0, -depth / 2);
  return geo;
}
export const circle = (r, n = 48, cx = 0, cy = 0) =>
  Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * Math.PI * 2), cy + r * Math.sin((i / n) * Math.PI * 2)]);

/** Spur-gear outline with n teeth; `inner` flips the teeth inward (ring gear). */
export function gear(n, pitchR, toothH, inner = false) {
  const pts = [];
  const ro = pitchR + (inner ? -toothH : toothH) / 2, ri = pitchR - (inner ? -toothH : toothH) / 2;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, s = (Math.PI * 2) / n;
    for (const [f, r] of [[0.0, ri], [0.22, ri], [0.34, ro], [0.66, ro], [0.78, ri]]) {
      pts.push([r * Math.cos(a + f * s), r * Math.sin(a + f * s)]);
    }
  }
  return pts;
}

export async function writeGLB(group, file) {
  group.updateMatrixWorld(true);
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('scene');
  const mats = new Map();
  let i = 0;
  group.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (!g.attributes.normal) g.computeVertexNormals();
    const m = o.material;
    if (!mats.has(m)) {
      const gm = doc.createMaterial(`m${mats.size}`)
        .setBaseColorFactor([m.color.r, m.color.g, m.color.b, m.opacity])
        .setMetallicFactor(m.metalness).setRoughnessFactor(m.roughness).setDoubleSided(true);
      if (m.transparent) gm.setAlphaMode('BLEND');
      mats.set(m, gm);
    }
    const acc = (attr) => doc.createAccessor().setType('VEC3').setArray(new Float32Array(attr.array)).setBuffer(buffer);
    const prim = doc.createPrimitive().setAttribute('POSITION', acc(g.attributes.position))
      .setAttribute('NORMAL', acc(g.attributes.normal)).setMaterial(mats.get(m));
    if (g.index) prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(g.index.array)).setBuffer(buffer));
    // Generic part names only — nothing in the file should give the answer away.
    scene.addChild(doc.createNode(`part${i}`).setMesh(doc.createMesh(`part${i++}`).addPrimitive(prim)));
  });
  await new NodeIO().write(file, doc);
}

export const CREDIT = {
  sourceSite: 'Shadowplay sample library',
  sourceUrl: '',
  creator: 'Shadowplay (procedurally generated)',
  licence: 'CC0 1.0',
  attribution: 'None required',
};
