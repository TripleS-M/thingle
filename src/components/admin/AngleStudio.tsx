'use client';

import { useEffect, useRef, useState } from 'react';
import ModelViewer, { type Offset } from '@/components/ModelViewer';
import { Gauge } from '@/components/game/Hints';
import { api } from '@/lib/client';
import { clamp, normaliseAz, PREVIEW_POSES } from '@/lib/camera';
import type { AssetMeta, CameraPose } from '@/lib/types';

type Mode = 'angle' | 'hint';
export const BACKDROPS: { value: string; label: string }[] = [
  { value: '', label: 'Paper' },
  { value: '#f4f2ec', label: 'White' },
  { value: '#d9d9d6', label: 'Pale grey' },
  { value: '#b9b9b5', label: 'Grey' },
];
/** Above this, the view is close to the object's broadest (most recognisable) profile. */
export const REVEALING = 0.72;

const samePose = (a: CameraPose, b: CameraPose) =>
  Math.abs(normaliseAz(a.az - b.az)) < 0.5 && Math.abs(a.el - b.el) < 0.5 && Math.abs(a.roll - b.roll) < 0.5 && Math.abs(a.zoom - b.zoom) < 0.01;
const tidy = (p: CameraPose): CameraPose => ({
  az: Math.round(normaliseAz(p.az)), el: Math.round(clamp(p.el, -89, 89)),
  roll: Math.round(clamp(p.roll, -180, 180)), zoom: Math.round(clamp(p.zoom, 0.4, 3) * 100) / 100,
});

function Slider({ label, value, min, max, step = 1, unit = '°', onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void;
}) {
  return (
    <label className="grid grid-cols-[5.2rem_1fr_4.4rem] items-center gap-3 text-sm">
      <span className="field-label !mb-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="flex items-center gap-1">
        <input type="number" min={min} max={max} step={step} value={value} aria-label={`${label} value`}
          onChange={(e) => onChange(clamp(Number(e.target.value) || 0, min, max))}
          className="field !min-h-0 !px-1.5 !py-0.5 text-right tabular-nums" />
        <span className="text-smoke">{unit}</span>
      </span>
    </label>
  );
}

/**
 * The silhouette preview tool: rotate freely, pick the starting angle, check how
 * revealing it is, and try the rotation hint exactly as a player would get it.
 */
export default function AngleStudio({ assetId, src, meta, onChange, onExposure }: {
  assetId: string;
  src: string;
  meta: AssetMeta;
  onChange: (patch: Partial<AssetMeta>) => void;
  /** Reports how revealing the *chosen starting angle* is (0..1), or null while unknown. */
  onExposure: (value: number | null) => void;
}) {
  const [mode, setMode] = useState<Mode>('angle');
  const [pose, setPose] = useState<CameraPose>(meta.camera);
  const [original, setOriginal] = useState(false);
  const [offset, setOffset] = useState<Offset>({ az: 0, el: 0 });
  const [exposure, setExposure] = useState<number | null>(null);
  const [startExposure, setStartExposure] = useState<number | null>(null);
  const atStart = samePose(pose, meta.camera);

  // How revealing is the view on screen? (debounced; the server measures the silhouette area)
  const seq = useRef(0);
  const { az, el, roll } = tidy(pose);
  useEffect(() => {
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const r = await api<{ exposure: number }>(`/api/admin/assets/${assetId}/exposure?az=${az}&el=${el}&roll=${roll}`);
        if (seq.current === mine) setExposure(r.exposure);
      } catch { if (seq.current === mine) setExposure(null); }
    }, 220);
    return () => clearTimeout(t);
  }, [assetId, az, el, roll]);

  // …and the same for the saved starting angle, which is what players actually get.
  const cam = meta.camera;
  useEffect(() => {
    let live = true;
    api<{ exposure: number }>(`/api/admin/assets/${assetId}/exposure?az=${cam.az}&el=${cam.el}&roll=${cam.roll}`)
      .then((r) => { if (live) { setStartExposure(r.exposure); onExposure(r.exposure); } })
      .catch(() => { if (live) { setStartExposure(null); onExposure(null); } });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId, cam.az, cam.el, cam.roll]);

  const set = (patch: Partial<CameraPose>) => setPose((p) => ({ ...p, ...patch }));
  const useView = () => onChange({ camera: tidy(pose) });
  const shown = mode === 'angle' ? exposure : startExposure;
  const pct = shown == null ? null : Math.round(shown * 100);
  const hot = shown != null && shown >= REVEALING;

  return (
    <div className="panel p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5" role="tablist" aria-label="Preview tool">
          <button type="button" role="tab" aria-selected={mode === 'angle'} className={`btn btn-sm ${mode === 'angle' ? 'btn-brass' : 'btn-ghost'}`} onClick={() => setMode('angle')}>Starting angle</button>
          <button type="button" role="tab" aria-selected={mode === 'hint'} className={`btn btn-sm ${mode === 'hint' ? 'btn-brass' : 'btn-ghost'}`}
            onClick={() => { setMode('hint'); setOffset({ az: 0, el: 0 }); setOriginal(false); }}>Test rotation hint</button>
        </div>
        {mode === 'angle' && (
          <div className="flex gap-1.5">
            <button type="button" aria-pressed={!original} className={`btn btn-sm ${!original ? 'btn-brass' : 'btn-ghost'}`} onClick={() => setOriginal(false)}>Silhouette</button>
            <button type="button" aria-pressed={original} className={`btn btn-sm ${original ? 'btn-brass' : 'btn-ghost'}`} onClick={() => setOriginal(true)}>Original</button>
          </div>
        )}
      </div>

      <div className="frame">
        {mode === 'angle' ? (
          <ModelViewer key="angle" src={src} camera={pose} control="free" onPose={(p) => setPose({ ...p, zoom: clamp(p.zoom, 0.4, 3) })}
            reveal={original} shadow={meta.shadow} background={meta.background || undefined}
            className="aspect-square w-full" label="Model preview — drag to rotate, scroll to zoom">
            <i className="corner tl" /><i className="corner tr" /><i className="corner br" /><i className="corner bl" />
          </ModelViewer>
        ) : (
          <ModelViewer key="hint" src={src} camera={meta.camera} control="limited" limits={meta.rotation} onOffset={setOffset}
            shadow={meta.shadow} background={meta.background || undefined}
            className="aspect-square w-full" label="Rotation hint preview — drag within the allowance">
            <i className="corner tl" /><i className="corner tr" /><i className="corner br" /><i className="corner bl" />
          </ModelViewer>
        )}
      </div>

      {/* Exposure meter */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="field-label !mb-0">{mode === 'angle' ? 'How revealing is this view' : 'How revealing is the starting angle'}</span>
          <span className={`tabular-nums ${hot ? 'text-stamp-hi' : 'text-smoke'}`}>{pct == null ? '—' : `${pct}%`}</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-sm border border-smoke/30 bg-walnut-950" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? 0} aria-label="How revealing this angle is">
          <div className="h-full transition-[width] duration-200" style={{ width: `${pct ?? 0}%`, background: hot ? 'var(--color-stamp-hi)' : (shown ?? 0) >= 0.5 ? '#e39a4c' : 'var(--color-banker-hi)' }} />
        </div>
        <p className={`mt-1.5 text-xs leading-relaxed ${hot ? 'text-stamp-hi' : 'text-smoke'}`}>
          {hot
            ? 'Careful — this is close to the object’s broadest, most recognisable profile. Players may name it at a glance. Try a more oblique or end-on angle.'
            : 'Measured from the silhouette’s area: 0% is the slimmest profile this object has, 100% the broadest. Lower is usually harder. It is a guide — always judge the shape yourself.'}
        </p>
      </div>

      {mode === 'angle' ? (
        <div className="mt-4 space-y-2.5">
          <Slider label="Turn" value={az} min={-180} max={180} onChange={(v) => set({ az: v })} />
          <Slider label="Tilt" value={el} min={-89} max={89} onChange={(v) => set({ el: v })} />
          <Slider label="Roll" value={roll} min={-180} max={180} onChange={(v) => set({ roll: v })} />
          <Slider label="Zoom" value={tidy(pose).zoom} min={0.4} max={3} step={0.01} unit="×" onChange={(v) => set({ zoom: v })} />
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button type="button" className="btn btn-brass btn-sm" onClick={useView} disabled={atStart}>
              {atStart ? 'This is the starting angle' : 'Use this view as the starting angle'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPose(meta.camera)} disabled={atStart}>Back to starting angle</button>
          </div>
          <p className="text-xs text-smoke">Drag to rotate · scroll to zoom · arrow keys nudge. Players see exactly the starting angle and cannot move it without the rotation hint.</p>

          <div className="pt-2">
            <p className="field-label">Generated silhouette previews — click to jump to that angle</p>
            <div className="grid grid-cols-4 gap-2">
              {PREVIEW_POSES.map((p, i) => (
                <button key={i} type="button" onClick={() => setPose({ ...p })} className="overflow-hidden rounded-sm border border-smoke/30 bg-[#e9e3d3] hover:border-brass-hi" aria-label={`Preview angle ${i + 1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/admin/assets/${assetId}/image?kind=${i}`} alt="" className="aspect-square w-full" loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="paper mt-4 space-y-2 p-3">
          <Gauge label="Sideways" value={offset.az} limit={meta.rotation.h} />
          <Gauge label="Up / down" value={offset.el} limit={meta.rotation.v} />
          <p className="muted text-xs">This is exactly what a player gets after buying the rotation hint: ±{meta.rotation.h}° sideways and ±{meta.rotation.v}° up / down around the starting angle, still in silhouette.</p>
        </div>
      )}

      <div className="mt-4 grid gap-3 border-t border-brass/20 pt-4 sm:grid-cols-2">
        <div>
          <span className="field-label">Rotation hint allowance</span>
          <div className="flex items-center gap-2 text-sm text-smoke">
            ±<input type="number" min={0} max={180} className="field !w-20" aria-label="Horizontal allowance in degrees" value={meta.rotation.h}
              onChange={(e) => onChange({ rotation: { ...meta.rotation, h: clamp(Number(e.target.value) || 0, 0, 180) } })} />° sideways
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-smoke">
            ±<input type="number" min={0} max={89} className="field !w-20" aria-label="Vertical allowance in degrees" value={meta.rotation.v}
              onChange={(e) => onChange({ rotation: { ...meta.rotation, v: clamp(Number(e.target.value) || 0, 0, 89) } })} />° up / down
          </div>
        </div>
        <div>
          <span className="field-label">Backdrop</span>
          <div className="flex flex-wrap gap-1.5">
            {BACKDROPS.map((b) => (
              <button key={b.label} type="button" aria-pressed={meta.background === b.value} onClick={() => onChange({ background: b.value })}
                className={`btn btn-sm ${meta.background === b.value ? 'btn-brass' : 'btn-ghost'}`}>
                <span className="inline-block h-3 w-3 rounded-full border border-black/40" style={{ background: b.value || '#e9e3d3' }} /> {b.label}
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-paper">
            <input type="checkbox" checked={meta.shadow} onChange={(e) => onChange({ shadow: e.target.checked })} className="h-4 w-4 accent-[var(--color-brass-hi)]" />
            Soft ground shadow
          </label>
        </div>
      </div>
    </div>
  );
}
