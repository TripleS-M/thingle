'use client';

import { useEffect, useState } from 'react';
import type { Offset } from '../ModelViewer';
import type { GameState, HintType } from '@/lib/types';

const EXHIBITS: { type: HintType; letter: string; title: string; teaser: string }[] = [
  { type: 'category', letter: 'A', title: 'Category', teaser: 'The broad field this object belongs to.' },
  { type: 'function', letter: 'B', title: 'What it does', teaser: 'A clue about its purpose or where it is found.' },
  { type: 'rotation', letter: 'C', title: 'Turn the photograph', teaser: 'Rotate the silhouette a little way round.' },
];

export function Gauge({ label, value, limit }: { label: string; value: number; limit: number }) {
  const ratio = limit > 0 ? Math.max(-1, Math.min(1, value / limit)) : 0;
  const atLimit = limit > 0 && Math.abs(value) >= limit - 0.25;
  const left = Math.max(0, limit - Math.abs(value));
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="label w-[4.6rem] shrink-0 !text-[0.6rem]">{label}</span>
      <div className="gauge flex-1" role="meter" aria-label={`${label} rotation`} aria-valuemin={-limit} aria-valuemax={limit} aria-valuenow={Math.round(value)}>
        <i style={{ left: `${50 + ratio * 50}%` }} data-limit={atLimit ? 'on' : 'off'} />
      </div>
      <span className="w-[6.4rem] shrink-0 text-right tabular-nums">
        {atLimit ? <strong className="text-stamp">at the limit</strong> : <>{Math.round(left)}° of {limit}° left</>}
      </span>
    </div>
  );
}

export default function Hints({ state, offset, busy, onUse }: {
  state: GameState; offset: Offset; busy: boolean; onUse: (type: HintType) => void;
}) {
  const [armed, setArmed] = useState<HintType | null>(null);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(null), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  const playing = state.status === 'playing';
  return (
    <div className="space-y-2.5">
      {EXHIBITS.map(({ type, letter, title, teaser }) => {
        const cost = state.scoring.hintCosts[type];
        const used = type === 'rotation' ? state.hints.rotation : state.hints[type] !== null;
        const text = type === 'rotation' ? null : state.hints[type];
        return (
          <div key={type} className="manila px-3.5 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="label !text-[0.62rem] opacity-70">Exhibit {letter}</p>
                <p className="typed text-base leading-tight">{title}</p>
              </div>
              {used ? (
                <span className="stamp small shrink-0">Opened · −{cost}</span>
              ) : playing ? (
                <button
                  type="button"
                  className={`btn btn-sm shrink-0 ${armed === type ? 'btn-danger' : 'btn-ink'}`}
                  disabled={busy}
                  onClick={() => { if (armed === type) { setArmed(null); onUse(type); } else setArmed(type); }}
                >
                  {armed === type ? `Confirm −${cost} pts` : `Open · −${cost}`}
                </button>
              ) : (
                <span className="label shrink-0 !text-[0.6rem] opacity-60">Sealed</span>
              )}
            </div>

            {!used && <p className="mt-1 text-sm opacity-75">{teaser}</p>}
            {used && text && <p className="typed rise mt-2 text-lg leading-snug">“{text}”</p>}
            {used && type === 'rotation' && (
              <div className="rise mt-2.5 space-y-2">
                {playing ? (
                  <>
                    <p className="text-sm">
                      Drag the photograph to turn it — up to ±{state.rotation.h}° sideways and ±{state.rotation.v}° up or down.
                    </p>
                    <Gauge label="Sideways" value={offset.az} limit={state.rotation.h} />
                    <Gauge label="Up / down" value={offset.el} limit={state.rotation.v} />
                  </>
                ) : (
                  <p className="text-sm opacity-75">Rotation was unlocked for this case.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
