// Three.js rendering engine for the silhouette viewer (framework-free).
// Renders on demand — nothing is drawn unless something changed — so an idle
// puzzle costs the browser nothing.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { cameraPosition, FOV_DEG } from '@/lib/camera';
import type { CameraPose } from '@/lib/types';

const RAD = Math.PI / 180;
const SPIN_DEG_PER_SEC = 14;

export class ViewerEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 0.05, 200);
  private holder = new THREE.Group();
  private black = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
  private meshes: { mesh: THREE.Mesh; original: THREE.Material | THREE.Material[] }[] = [];
  private extras: THREE.Object3D[] = []; // lines / points: hidden while silhouetted
  private shadow: THREE.Mesh | null = null;
  private pose: CameraPose;
  private reveal = false;
  private spin = false;
  private spinAngle = 0;
  private shadowOn = false;
  private raf = 0;
  private last = 0;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, pose: CameraPose) {
    this.pose = pose;
    // Transparent canvas: the "photographic paper" behind it is plain CSS.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.75;
    pmrem.dispose();
    const key = new THREE.DirectionalLight(0xfff0dc, 2.0);
    key.position.set(3, 5, 4);
    this.scene.add(key, new THREE.HemisphereLight(0xffffff, 0x8a7a66, 0.6), this.holder);
  }

  async load(src: string): Promise<void> {
    const loader = new GLTFLoader();
    const draco = new DRACOLoader().setDecoderPath('/draco/');
    loader.setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
    try {
      const gltf = await loader.loadAsync(src);
      if (this.disposed) return;
      const root = gltf.scene;
      root.updateMatrixWorld(true);

      // Centre on the bounding box and scale the bounding sphere to radius 1
      // (identical to the server-side preview renderer).
      const box = new THREE.Box3(), v = new THREE.Vector3();
      const each = (fn: (p: THREE.Vector3) => void) => root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.geometry?.attributes.position) return;
        const pos = m.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) fn(v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld));
      });
      each((p) => box.expandByPoint(p));
      if (box.isEmpty()) throw new Error('Model contains no geometry');
      const centre = box.getCenter(new THREE.Vector3());
      let r2 = 0;
      each((p) => { r2 = Math.max(r2, p.distanceToSquared(centre)); });
      const scale = 1 / (Math.sqrt(r2) || 1);
      this.holder.scale.setScalar(scale);
      this.holder.position.copy(centre).multiplyScalar(-scale);
      this.holder.add(root);

      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) { m.frustumCulled = false; this.meshes.push({ mesh: m, original: m.material }); }
        else if ((o as THREE.Line).isLine || (o as THREE.Points).isPoints) this.extras.push(o);
        else if ((o as THREE.Light).isLight) o.visible = false; // embedded lights would break consistent reveals
      });
      this.buildShadow((box.min.y - centre.y) * scale);
      this.applyMaterials();
      this.invalidate();
    } finally {
      draco.dispose();
    }
  }

  private buildShadow(y: number) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0,0,0,0.5)'); grad.addColorStop(0.55, 'rgba(0,0,0,0.16)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.7),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = y - 0.004;
    this.shadow.renderOrder = -1;
    this.scene.add(this.shadow);
  }

  private applyMaterials() {
    for (const { mesh, original } of this.meshes) mesh.material = this.reveal ? original : this.black;
    for (const o of this.extras) o.visible = this.reveal;
  }

  setPose(pose: CameraPose) { this.pose = pose; this.invalidate(); }
  setShadow(on: boolean) { this.shadowOn = on; this.invalidate(); }
  setReveal(on: boolean) { if (on !== this.reveal) { this.reveal = on; this.applyMaterials(); this.invalidate(); } }
  setSpin(on: boolean) {
    if (on === this.spin) return;
    this.spin = on; this.last = 0;
    this.invalidate();
  }
  /** Angle added by the turntable so far — lets the caller take over smoothly. */
  takeSpin(): number { const a = this.spinAngle; this.spinAngle = 0; return a; }

  resize(width: number, height: number) {
    if (width < 2 || height < 2) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    this.camera.aspect = aspect;
    // Fit the bounding sphere to the narrower dimension.
    this.camera.fov = aspect >= 1 ? FOV_DEG : (2 * Math.atan(Math.tan((FOV_DEG * RAD) / 2) / aspect)) / RAD;
    this.camera.updateProjectionMatrix();
    this.invalidate();
  }

  invalidate() {
    if (!this.raf && !this.disposed) this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    this.raf = 0;
    if (this.disposed) return;
    if (this.spin) {
      if (this.last) this.spinAngle += Math.min(0.1, (now - this.last) / 1000) * SPIN_DEG_PER_SEC;
      this.last = now;
    }
    const p = this.pose;
    const [x, y, z] = cameraPosition({ az: p.az + this.spinAngle, el: p.el, zoom: p.zoom });
    this.camera.position.set(x, y, z);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);
    this.camera.rotateZ(p.roll * RAD);
    if (this.shadow) {
      // Only when looking down at the "table"; fades out as the view flattens.
      const fade = Math.min(1, Math.max(0, (p.el - 5) / 18));
      this.shadow.visible = this.shadowOn && fade > 0;
      (this.shadow.material as THREE.MeshBasicMaterial).opacity = fade;
    }
    this.renderer.render(this.scene, this.camera);
    if (this.spin && document.visibilityState === 'visible') this.invalidate();
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    const dropMaterial = (m: THREE.Material) => {
      for (const value of Object.values(m)) if ((value as THREE.Texture)?.isTexture) (value as THREE.Texture).dispose();
      m.dispose();
    };
    for (const { mesh, original } of this.meshes) {
      mesh.geometry.dispose();
      (Array.isArray(original) ? original : [original]).forEach(dropMaterial);
    }
    if (this.shadow) { this.shadow.geometry.dispose(); dropMaterial(this.shadow.material as THREE.Material); }
    this.black.dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // browsers cap live WebGL contexts; give this one back now
  }
}
