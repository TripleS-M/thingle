'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clamp } from '@/lib/camera';
import type { CameraPose } from '@/lib/types';
import type { ViewerEngine } from './viewer/engine';

export type ViewerControl = 'none' | 'limited' | 'free';
export interface Offset { az: number; el: number }

interface Props {
  src: string;
  /** Starting pose. In `free` mode with `onPose`, this is the controlled pose. */
  camera: CameraPose;
  control?: ViewerControl;
  /** `limited` mode: how far the view may move from `camera`, in degrees each way. */
  limits?: { h: number; v: number };
  initialOffset?: Offset;
  onOffset?: (offset: Offset) => void;
  onPose?: (pose: CameraPose) => void;
  reveal?: boolean;
  spin?: boolean;
  shadow?: boolean;
  background?: string;
  className?: string;
  label?: string;
  children?: React.ReactNode;
}

const DRAG_DEG_PER_PX = 0.32;
const RAD = Math.PI / 180;

export default function ModelViewer({
  src, camera, control = 'none', limits, initialOffset, onOffset, onPose,
  reveal = false, spin = false, shadow = false, background, className = '', label, children,
}: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null); // holds only the canvas (never React children)
  const engine = useRef<ViewerEngine | null>(null);
  const pose = useRef<CameraPose>({ ...camera });
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  // Latest props for event handlers, without re-binding listeners.
  const live = useRef({ camera, control, limits, onOffset, onPose, spin });
  live.current = { camera, control, limits, onOffset, onPose, spin };
  const spinStopped = useRef(false);

  // ── Engine lifecycle ────────────────────────────────────────────────────
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cancelled = false;
    let instance: ViewerEngine | null = null;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    el.appendChild(canvas);
    setPhase('loading');

    const observer = new ResizeObserver(() => instance?.resize(el.clientWidth, el.clientHeight));
    (async () => {
      try {
        const { ViewerEngine } = await import('./viewer/engine');
        if (cancelled) return;
        instance = new ViewerEngine(canvas, pose.current);
        engine.current = instance;
        instance.resize(el.clientWidth, el.clientHeight);
        observer.observe(el);
        await instance.load(src);
        if (!cancelled) setPhase('ready');
      } catch (e) {
        console.error('[viewer]', e);
        if (!cancelled) setPhase('error');
      }
    })();

    return () => {
      cancelled = true;
      observer.disconnect();
      instance?.dispose();
      if (engine.current === instance) engine.current = null;
      canvas.remove();
    };
  }, [src, attempt]);

  // ── Pose follows the starting camera (plus any restored offset) ─────────
  const offsetKey = `${initialOffset?.az ?? 0}:${initialOffset?.el ?? 0}`;
  useEffect(() => {
    const o = control === 'limited' && initialOffset ? initialOffset : { az: 0, el: 0 };
    const h = limits?.h ?? 0, v = limits?.v ?? 0;
    pose.current = {
      ...camera,
      az: camera.az + clamp(o.az, -h, h),
      el: clamp(camera.el + clamp(o.el, -v, v), -89, 89),
    };
    engine.current?.setPose(pose.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera.az, camera.el, camera.roll, camera.zoom, control, limits?.h, limits?.v, offsetKey, phase]);

  useEffect(() => { engine.current?.setReveal(reveal); }, [reveal, phase]);
  useEffect(() => { engine.current?.setShadow(shadow); }, [shadow, phase]);
  useEffect(() => {
    spinStopped.current = false;
    engine.current?.setSpin(spin);
  }, [spin, phase]);

  // ── Rotation ────────────────────────────────────────────────────────────
  const rotate = useCallback((dAz: number, dEl: number, dZoom = 0) => {
    const { camera: base, control: mode, limits: lim, onOffset: emitOffset, onPose: emitPose, spin: spinning } = live.current;
    const eng = engine.current;
    if (!eng || mode === 'none') return;
    const p = { ...pose.current };
    if (spinning && !spinStopped.current) { // the player takes over from the turntable
      p.az += eng.takeSpin();
      eng.setSpin(false);
      spinStopped.current = true;
    }
    if (mode === 'limited') {
      const h = lim?.h ?? 0, v = lim?.v ?? 0;
      p.az = clamp(p.az + dAz, base.az - h, base.az + h);
      p.el = clamp(clamp(p.el + dEl, base.el - v, base.el + v), -89, 89);
      emitOffset?.({ az: p.az - base.az, el: p.el - base.el });
    } else {
      p.az += dAz;
      p.el = clamp(p.el + dEl, -89, 89);
      p.zoom = clamp(p.zoom * (1 + dZoom), 0.4, 4);
      emitPose?.(p);
    }
    pose.current = p;
    eng.setPose(p);
  }, []);

  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (control === 'none' || phase !== 'ready' || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    d.x = e.clientX; d.y = e.clientY;
    // Un-roll the drag so "sideways on screen" always turns the object sideways on screen.
    const r = pose.current.roll * RAD;
    const alongRight = dx * Math.cos(r) + dy * Math.sin(r);
    const alongUp = dx * Math.sin(r) - dy * Math.cos(r);
    rotate(-alongRight * DRAG_DEG_PER_PX, -alongUp * DRAG_DEG_PER_PX);
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 3;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const m = moves[e.key];
    if (!m || control === 'none') return;
    e.preventDefault();
    rotate(m[0], m[1]);
  };

  // Wheel zoom (free mode only). Needs a non-passive listener to stop the page scrolling.
  useEffect(() => {
    const el = wrap.current;
    if (!el || control !== 'free') return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); rotate(0, 0, -Math.sign(e.deltaY) * 0.06); };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [control, rotate]);

  const draggable = control !== 'none' && phase === 'ready';
  return (
    <div
      ref={wrap}
      className={`photo ${className}`}
      style={background ? { backgroundColor: background } : undefined}
      data-drag={draggable ? 'on' : 'off'}
      role="img"
      aria-label={label ?? 'Silhouette of the mystery object'}
      tabIndex={draggable ? 0 : -1}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
    >
      <div ref={host} className="absolute inset-0" />
      {phase === 'loading' && (
        <div className="absolute inset-0 z-[2] grid place-items-center text-typeink/70">
          <div className="label flex items-center gap-2">
            <span className="pulse-dot">●</span> Developing photograph…
          </div>
        </div>
      )}
      {phase === 'error' && (
        <div className="absolute inset-0 z-[2] grid place-items-center p-6 text-center text-typeink">
          <div>
            <p className="typed text-lg">The evidence could not be loaded.</p>
            <p className="mt-1 text-sm text-faded">The 3D model failed to open, or your browser has WebGL switched off.</p>
            <button type="button" className="btn btn-ink btn-sm mt-4" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
