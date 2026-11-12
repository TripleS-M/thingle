'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ModelViewer, { type Offset } from './ModelViewer';
import Paperclip from './Paperclip';
import Shell from './Shell';
import FeedbackDialog from './game/FeedbackDialog';
import Hints from './game/Hints';
import HowTo from './game/HowTo';
import Result from './game/Result';
import StatsDialog from './game/StatsDialog';
import { api, caseNo, formatDate, save, store } from '@/lib/client';
import { isMuted, playFailed, playScratch, playSolved, setMuted, unlockAudio } from '@/lib/sfx';
import type { CameraPose, GameMode, GameState, HintType } from '@/lib/types';

interface Loaded { state: GameState | null; timezone: string }
const ZERO: Offset = { az: 0, el: 0 };

/** Where the camera settles once the object is revealed. */
const revealPose = (c: CameraPose): CameraPose => ({ az: c.az, el: 18, roll: 0, zoom: 1 });
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export default function Game({ mode, gameKey }: { mode: GameMode; gameKey?: string }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState('');
  const [guess, setGuess] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; kind: 'wrong' | 'error' } | null>(null);
  const [shake, setShake] = useState(0);
  const [dialog, setDialog] = useState<'help' | 'stats' | 'feedback' | null>(null);
  const [folder, setFolder] = useState<'opening' | 'open'>('opening'); // the case folder swings open for each new case
  const [opens, setOpens] = useState(0);
  const [muted, setMutedState] = useState(false);
  const [offset, setOffset] = useState<Offset>(ZERO);
  const [initialOffset, setInitialOffset] = useState<Offset>(ZERO);
  const [settling, setSettling] = useState<CameraPose | null>(null); // camera gliding to the reveal pose
  const input = useRef<HTMLInputElement>(null);
  const state = loaded?.state ?? null;
  const rotKey = state ? `sp:rot:${state.mode}:${state.key}` : '';
  const fbKey = state ? `sp:fb:${state.mode}:${state.key}` : '';

  useEffect(() => { setMutedState(isMuted()); }, []);
  const toggleSound = () => { const next = !muted; setMuted(next); setMutedState(next); if (!next) unlockAudio(); };
  const reopenFolder = () => { setFolder('opening'); setOpens((n) => n + 1); };
  // Safety net: if the opening animation never reports back (hidden tab), finish it anyway.
  const hasCase = !!state;
  useEffect(() => {
    if (!hasCase) return;
    const t = setTimeout(() => setFolder('open'), 2600);
    return () => clearTimeout(t);
  }, [hasCase, opens]);

  const load = useCallback(async (quiet = false) => {
    try {
      const query = `mode=${mode}${gameKey ? `&key=${encodeURIComponent(gameKey)}` : ''}`;
      const next = await api<Loaded>(`/api/game?${query}`);
      setLoaded(next);
      setLoadError('');
    } catch (e) {
      if (!quiet) setLoadError((e as Error).message);
    }
  }, [mode, gameKey]);

  useEffect(() => { load(); }, [load]);

  // A daily tab left open overnight should pick up the new case when it is looked at again.
  useEffect(() => {
    if (mode !== 'daily') return;
    const onVisible = () => { if (document.visibilityState === 'visible') load(true); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [mode, load]);

  // Restore how far the photograph had been turned (rotation hint) for this case.
  useEffect(() => {
    if (!rotKey) return;
    const saved = store<Offset>(rotKey, ZERO);
    const clean = { az: Number(saved?.az) || 0, el: Number(saved?.el) || 0 };
    setInitialOffset(clean);
    setOffset(clean);
  }, [rotKey]);

  useEffect(() => {
    if (mode !== 'daily' || !loaded || store('sp:help-seen', false)) return;
    save('sp:help-seen', true);
    if (loaded.state?.status === 'playing' && loaded.state.guesses.length === 0) setDialog('help');
  }, [mode, loaded]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onOffset = useCallback((o: Offset) => {
    setOffset(o);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(rotKey, o), 150);
  }, [rotKey]);

  /** Glide the camera from wherever the player left it to the reveal pose. */
  const settle = useCallback((from: CameraPose, to: CameraPose) => {
    const start = performance.now(), duration = 1100;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration), k = ease(t);
      if (t >= 1) { setSettling(null); return; }
      setSettling({
        az: from.az + (to.az - from.az) * k, el: from.el + (to.el - from.el) * k,
        roll: from.roll + (to.roll - from.roll) * k, zoom: from.zoom + (to.zoom - from.zoom) * k,
      });
      requestAnimationFrame(step);
    };
    setSettling(from);
    requestAnimationFrame(step);
  }, []);

  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (feedbackTimer.current) clearTimeout(feedbackTimer.current); }, []);
  const closeFeedback = () => { save(fbKey, true); setDialog(null); };

  const apply = (next: GameState, previous: GameState) => {
    if (previous.status === 'playing' && next.status !== 'playing') {
      const c = previous.camera;
      const turned = previous.hints.rotation ? offset : ZERO;
      settle({ ...c, az: c.az + turned.az, el: c.el + turned.el }, revealPose(next.camera));
      // Once the result has landed, ask (once) how the case felt.
      if (next.mode !== 'preview' && !store(`sp:fb:${next.mode}:${next.key}`, false)) {
        feedbackTimer.current = setTimeout(() => setDialog((d) => d ?? 'feedback'), 2800);
      }
    }
    setLoaded((l) => (l ? { ...l, state: next } : l));
  };

  const act = async (body: Record<string, unknown>, after?: (r: { state: GameState; correct?: boolean; message?: string }) => void) => {
    if (!state || busy) return;
    setBusy(true);
    try {
      const r = await api<{ state: GameState; correct?: boolean; message?: string }>('/api/game', {
        method: 'POST', json: { mode: state.mode, key: state.key, ...body },
      });
      apply(r.state, state);
      setFeedback(null);
      after?.(r);
    } catch (e) {
      setFeedback({ text: (e as Error).message, kind: 'error' });
      if ((e as { status?: number }).status === 409) load(true);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guess.trim()) { input.current?.focus(); return; }
    unlockAudio(); // must happen inside the key press / tap, before the request
    act({ action: 'guess', guess }, (r) => {
      setGuess('');
      if (r.correct) playSolved(); else if (r.state.status === 'lost') playFailed(); else playScratch();
      if (!r.correct && r.state.status === 'playing') {
        setFeedback({ text: r.message ?? 'Not quite. Take another look.', kind: 'wrong' });
        setShake((n) => n + 1);
        requestAnimationFrame(() => input.current?.focus());
      }
    });
  };
  const openHint = (hint: HintType) => act({ action: 'hint', hint });
  const reset = () => act({ action: 'reset' }, () => { save(rotKey, ZERO); setOffset(ZERO); setInitialOffset({ ...ZERO }); setGuess(''); reopenFolder(); });

  const potential = useMemo(() => {
    if (!state || state.status !== 'playing') return 0;
    const { guessPoints, hintCosts } = state.scoring;
    const spent = (state.hints.category !== null ? hintCosts.category : 0)
      + (state.hints.function !== null ? hintCosts.function : 0) + (state.hints.rotation ? hintCosts.rotation : 0);
    return Math.max(0, (guessPoints[state.guesses.length] ?? 0) - spent);
  }, [state]);

  const actions = (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDialog('help')}>How to play</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDialog('stats')}>Record</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={toggleSound} aria-pressed={!muted} title={muted ? 'Turn sound effects on' : 'Turn sound effects off'}>
        Sound {muted ? 'off' : 'on'}
      </button>
    </>
  );
  const dialogs = (
    <>
      {dialog === 'help' && <HowTo scoring={state?.scoring ?? null} onClose={() => setDialog(null)} />}
      {dialog === 'stats' && <StatsDialog onClose={() => setDialog(null)} />}
      {dialog === 'feedback' && state && state.status !== 'playing' && <FeedbackDialog state={state} onClose={closeFeedback} />}
    </>
  );

  // ── Loading / failure / nothing scheduled ───────────────────────────────
  if (!loaded) {
    return (
      <Shell actions={actions}>
        <div className="grid min-h-[50vh] place-items-center text-center">
          {loadError ? (
            <div className="paper max-w-md p-7">
              <p className="typed text-xl">The case file would not open.</p>
              <p className="muted mt-2 text-sm">{loadError}</p>
              <button type="button" className="btn btn-ink mt-5" onClick={() => load()}>Try again</button>
            </div>
          ) : (
            <p className="label text-smoke"><span className="pulse-dot">●</span> Fetching today&rsquo;s case…</p>
          )}
        </div>
        {dialogs}
      </Shell>
    );
  }

  if (!state) {
    return (
      <Shell actions={actions}>
        <div className="grid min-h-[55vh] place-items-center">
          <div className="paper rise max-w-lg p-7 text-center sm:p-10">
            <span className="stamp">No case filed</span>
            <h1 className="typed mt-6 text-2xl">
              {mode === 'daily' ? 'The desk is empty today.' : 'That case file could not be found.'}
            </h1>
            <p className="muted mt-3">
              {mode === 'daily'
                ? 'No mystery object has been scheduled for today. Check back tomorrow — or reopen an old file and practise in the meantime.'
                : 'It may not have been released yet, or it was withdrawn from the archive.'}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Link href="/archive" className="btn btn-ink !no-underline">Open the case archive</Link>
              {mode !== 'daily' && <Link href="/" className="btn btn-line !no-underline">Today&rsquo;s case</Link>}
            </div>
          </div>
        </div>
        {dialogs}
      </Shell>
    );
  }

  // ── The case ────────────────────────────────────────────────────────────
  const playing = state.status === 'playing';
  const won = state.status === 'won';
  const turning = playing && state.hints.rotation;
  const camera = playing ? state.camera : settling ?? revealPose(state.camera);

  return (
    <Shell actions={actions}>
      {state.mode !== 'daily' && (
        <div className="manila mb-5 flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
          <span>
            <strong className="typed tracking-wider uppercase">{state.mode === 'practice' ? 'Practice' : 'Admin preview'}</strong>
            {' — '}
            {state.mode === 'practice'
              ? `an archived case${state.date ? ` from ${formatDate(state.date)}` : ''}. It does not count toward your record.`
              : `players cannot see this${state.date ? ` (set for ${formatDate(state.date)})` : ''}. Nothing here is recorded in stats.`}
          </span>
          {playing && state.guesses.length > 0 && (
            <button type="button" className="btn btn-line btn-sm" disabled={busy} onClick={reset}>Start over</button>
          )}
        </div>
      )}

      <div className="dossier mt-8 grid items-stretch gap-8 lg:grid-cols-2 lg:gap-0" data-open={folder} key={opens}>
        {/* Left half of the folder (the inside of its cover): the photograph, paper-clipped in place */}
        <section aria-label="Evidence photograph" className="leaf leaf-left"
          onAnimationEnd={(e) => { if (e.animationName === 'leaf-open') setFolder('open'); }}>
          <div className="leaf-face leaf-inside">
            <div className="mx-auto max-w-[34rem] lg:sticky lg:top-8">
              <div className="print mt-5 sm:mt-6">
                <Paperclip />
                <ModelViewer
                  key={state.model}
                  src={state.model}
                  camera={camera}
                  control={playing ? (turning ? 'limited' : 'none') : settling ? 'none' : 'free'}
                  limits={state.rotation}
                  initialOffset={initialOffset}
                  onOffset={onOffset}
                  reveal={!playing}
                  spin={!playing && !settling}
                  shadow={state.shadow}
                  background={state.background || undefined}
                  className="aspect-square w-full"
                  label={playing ? 'Black silhouette of the mystery object' : `The object revealed: ${state.result?.answer ?? ''}`}
                />
              </div>
              {(turning || !playing) && (
                <p className="label mt-4 text-center opacity-75 !tracking-[0.14em]">
                  {playing ? 'Drag the photograph to turn it — within the limits' : 'Drag to inspect the object'}
                </p>
              )}
            </div>
          </div>
          <div className="leaf-face leaf-cover" aria-hidden="true">
            <div className="cover-label">
              <p className="label">Case file</p>
              <p className="font-display mt-1 text-4xl font-black tracking-[0.18em] uppercase">Thingle</p>
              <p className="typed mt-2 text-lg">No. {caseNo(state.number)}</p>
              <span className="stamp small mt-3">Confidential</span>
            </div>
          </div>
        </section>

        {/* Case file */}
        <section aria-label="Case file" className="leaf leaf-right">
          <span className="folder-tab" aria-hidden="true">Case No. {caseNo(state.number)}</span>
          <div className="leaf-face leaf-inside">
          <div className="paper p-5 sm:p-7">
          <div className="rule mb-5 flex flex-wrap items-baseline justify-between gap-2 pb-3">
            <h1 className="typed text-xl sm:text-2xl">Case file No. {caseNo(state.number)}</h1>
            {state.date && <span className="label muted">{formatDate(state.date)}</span>}
          </div>

          {playing ? (
            <>
              <form onSubmit={submit} key={shake} className={shake ? 'shake' : ''}>
                <label htmlFor="guess" className="label muted block">What is this object?</label>
                <div className="mt-1 flex items-end gap-3">
                  <input
                    id="guess"
                    ref={input}
                    className="type-input"
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
                    placeholder="Type your answer…"
                    maxLength={80}
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="send"
                    disabled={busy}
                  />
                  <button type="submit" className="btn btn-ink shrink-0" disabled={busy || !guess.trim()}>Submit</button>
                </div>
              </form>
              <p className="mt-2 min-h-6 text-[0.95rem] font-bold text-stamp" role="status" aria-live="polite">
                {feedback?.text}
              </p>
              <p className="muted text-sm">
                Guess {state.guesses.length + 1} of {state.maxGuesses} · solve it now for {potential} points
              </p>
            </>
          ) : (
            <Result state={state} timezone={loaded.timezone} busy={busy} onStats={() => setDialog('stats')} onReset={reset}
              onFeedback={state.mode === 'preview' ? undefined : () => setDialog('feedback')} />
          )}

          {/* Suspect list */}
          <div className="mt-5">
            <p className="label muted mb-1">Your guesses</p>
            <ol>
              {Array.from({ length: state.maxGuesses }, (_, i) => {
                const text = state.guesses[i];
                const correct = won && i === state.guesses.length - 1;
                return (
                  <li key={i} className="rule flex min-h-9 items-center gap-3 py-1">
                    <span className="typed muted w-5 text-right">{i + 1}.</span>
                    {text === undefined ? (
                      <span className="muted text-sm">{playing && i === state.guesses.length ? '— your next guess —' : ''}</span>
                    ) : correct ? (
                      <span className="typed text-lg font-bold text-[#1f6b43]">{text} <span aria-label="correct">✓</span></span>
                    ) : (
                      <span className="typed strike text-lg text-typeink/75">{text}</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="mt-6">
            <p className="label muted mb-2">
              {playing ? 'Hints — free to open, but each costs points' : 'Hints'}
            </p>
            <Hints state={state} offset={offset} busy={busy} onUse={openHint} />
          </div>
          </div>
          </div>
        </section>

        {/* Small screens: a cover swings away instead of the left half turning */}
        {folder === 'opening' && (
          <div className="leaf-face swing-cover" aria-hidden="true" onAnimationEnd={(e) => { if (e.animationName === 'swing-open') setFolder('open'); }}>
            <div className="cover-label">
              <p className="label">Case file</p>
              <p className="font-display mt-1 text-3xl font-black tracking-[0.18em] uppercase">Thingle</p>
              <p className="typed mt-2 text-lg">No. {caseNo(state.number)}</p>
              <span className="stamp small mt-3">Confidential</span>
            </div>
          </div>
        )}
      </div>
      {dialogs}
    </Shell>
  );
}
