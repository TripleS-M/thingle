'use client';

import { useEffect, useState } from 'react';

// The paperclip is a real 3D object (a steel wire bent into the classic
// three-loop shape) rendered with Three.js — but only once. The frame is kept
// as an image and the WebGL context is released straight away, so it costs
// nothing while the game is being played.
let cached: string | null = null;
let pending: Promise<string> | null = null;

async function renderClip(): Promise<string> {
  const THREE = await import('three');
  const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');

  // Trace the wire: straight runs joined by half-circles, from the inner end to the outer end.
  const pts: InstanceType<typeof THREE.Vector3>[] = [];
  const line = (x: number, y0: number, y1: number, z: number) => {
    for (let i = 0; i <= 8; i++) pts.push(new THREE.Vector3(x, y0 + ((y1 - y0) * i) / 8, z));
  };
  const arc = (cx: number, cy: number, r: number, from: number, to: number, z0: number, z1: number) => {
    for (let i = 1; i < 16; i++) {
      const a = from + ((to - from) * i) / 16;
      pts.push(new THREE.Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z0 + ((z1 - z0) * i) / 16));
    }
  };
  line(-0.24, 0.72, -1.02, 0.05);
  arc(0.05, -1.02, 0.29, Math.PI, Math.PI * 2, 0.05, 0.02);
  line(0.34, -1.02, 1.2, 0.02);
  arc(-0.06, 1.2, 0.4, 0, Math.PI, 0.02, -0.03);
  line(-0.46, 1.2, -1.22, -0.03);
  arc(0.02, -1.22, 0.48, Math.PI, Math.PI * 2, -0.03, -0.05);
  line(0.5, -1.22, 0.9, -0.05);

  const W = 120, H = 330; // rendered at about 3x the size it is shown
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  try {
    renderer.setSize(W, H, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const wire = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 320, 0.045, 12, false),
      new THREE.MeshStandardMaterial({ color: 0xcfd3d8, metalness: 1, roughness: 0.22 }),
    );
    wire.rotation.set(-0.12, 0.3, 0); // a slight turn so the wire catches the light like a real clip
    scene.add(wire);
    const key = new THREE.DirectionalLight(0xfff0d2, 2.2);
    key.position.set(-2, 3, 4);
    scene.add(key);

    const halfH = 1.86, halfW = (halfH * W) / H;
    const camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 20);
    camera.position.set(0, 0, 6);
    renderer.render(scene, camera);
    const url = canvas.toDataURL('image/png');
    wire.geometry.dispose();
    (wire.material as InstanceType<typeof THREE.MeshStandardMaterial>).dispose();
    scene.environment.dispose();
    pmrem.dispose();
    return url;
  } finally {
    renderer.dispose();
    renderer.forceContextLoss();
  }
}

/** Decorative only. If WebGL is unavailable it simply does not appear. */
export default function Paperclip({ className = '' }: { className?: string }) {
  const [src, setSrc] = useState(cached);
  useEffect(() => {
    if (cached) { setSrc(cached); return; }
    let live = true;
    pending ??= renderClip();
    pending.then((url) => { cached = url; if (live) setSrc(url); }).catch(() => { pending = null; });
    return () => { live = false; };
  }, []);
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" aria-hidden="true" draggable={false} className={`paperclip ${className}`} />;
}
