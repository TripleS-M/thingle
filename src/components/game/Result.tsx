'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { caseNo, secondsToMidnight } from '@/lib/client';
import type { GameState, HintType } from '@/lib/types';

const HINT_LABELS: [HintType, string][] = [['category', 'Category'], ['function', 'Function'], ['rotation', 'Rotation']];

function Countdown({ timezone }: { timezone: string }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(secondsToMidnight(timezone));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [timezone]);
  if (left === null) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <p className="text-sm">
      <span className="label muted mr-2">Next case in</span>
      <span className="typed text-lg tabular-nums">{pad(Math.floor(left / 3600))}:{pad(Math.floor((left % 3600) / 60))}:{pad(left % 60)}</span>
    </p>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers / insecure origins: fall back to a hidden textarea.
    const area = document.createElement('textarea');
    area.value = text;
    area.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    area.remove();
    return ok;
  }
}

export default function Result({ state, timezone, busy, onStats, onReset }: {
  state: GameState; timezone: string; busy: boolean; onStats: () => void; onReset: () => void;
}) {
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');
  const result = state.result;
  if (!result) return null;
  const won = state.status === 'won';
  const used: Record<HintType, boolean> = {
    category: state.hints.category !== null, function: state.hints.function !== null, rotation: state.hints.rotation,
  };
  const credit = result.credit;

  const copy = async () => {
    setCopied((await copyText(`${result.share}\n${window.location.origin}`)) ? 'ok' : 'fail');
    setTimeout(() => setCopied('idle'), 2400);
  };

  return (
    <div className="rise space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div>
          <p className="label muted">Shadowplay #{caseNo(state.number)}</p>
          <p className="typed mt-1 text-lg">
            {won ? `Solved in ${state.guesses.length}/${state.maxGuesses} guesses` : `Unsolved after ${state.maxGuesses} guesses`}
          </p>
        </div>
        <span className={`stamp stamp-in ${won ? 'green' : ''}`}>{won ? 'Case closed' : 'Cold case'}</span>
      </div>

      <div className="rule pb-4">
        <p className="label muted">The object was</p>
        <h2 className="mt-1 font-display text-3xl leading-tight font-black sm:text-4xl">{result.answer}</h2>
        {result.category && <p className="label mt-2">{result.category}</p>}
        {result.description && <p className="mt-2 text-[0.95rem]">{result.description}</p>}
      </div>

      <div className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3">
        <div>
          <p className="label muted">Score</p>
          <p className="typed text-4xl leading-none">
            {result.score}<span className="muted text-xl">/{result.maxScore}</span>
          </p>
        </div>
        <ul className="space-y-0.5 text-sm">
          {HINT_LABELS.map(([type, label]) => (
            <li key={type} className="flex justify-between gap-3">
              <span>{label} hint</span>
              <span className={used[type] ? 'font-bold text-stamp' : 'muted'}>
                {used[type] ? `Used · −${state.scoring.hintCosts[type]}` : 'Not used'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="label muted mb-1.5">Share without spoilers</p>
        <pre className="typed overflow-x-auto border border-dashed border-typeink/40 bg-typeink/5 px-3 py-2.5 text-[0.95rem] leading-relaxed whitespace-pre-wrap">{result.share}</pre>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button type="button" className="btn btn-ink" onClick={copy}>
            {copied === 'ok' ? 'Copied ✓' : copied === 'fail' ? 'Copy failed — select the text' : 'Copy result'}
          </button>
          <button type="button" className="btn btn-line" onClick={onStats}>Your record</button>
        </div>
      </div>

      <div className="rule" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        {state.mode === 'daily' ? <Countdown timezone={timezone} /> : (
          <button type="button" className="btn btn-line btn-sm" disabled={busy} onClick={onReset}>
            {state.mode === 'preview' ? 'Reset preview' : 'Try this case again'}
          </button>
        )}
        {state.mode !== 'preview' && <Link href="/archive" className="btn btn-line btn-sm !no-underline">Practise old cases</Link>}
      </div>

      {(credit.creator || credit.licence || credit.sourceSite || credit.sourceUrl) && (
        <p className="muted text-xs leading-relaxed">
          3D model{credit.creator && <> by {credit.creator}</>}
          {credit.licence && <> · {credit.licence}</>}
          {(credit.sourceSite || credit.sourceUrl) && (
            <> · {/^https?:\/\//.test(credit.sourceUrl)
              ? <a href={credit.sourceUrl} target="_blank" rel="noopener noreferrer">{credit.sourceSite || 'Source'}</a>
              : credit.sourceSite}</>
          )}
          {credit.attribution && !/^none/i.test(credit.attribution) && <><br />{credit.attribution}</>}
        </p>
      )}
    </div>
  );
}
