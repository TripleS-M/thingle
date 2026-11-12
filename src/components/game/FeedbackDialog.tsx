'use client';

import { useState } from 'react';
import Dialog from '../Dialog';
import { api } from '@/lib/client';
import { RATING_LABELS, type GameState } from '@/lib/types';

/** Asked once after a case ends: how hard did it feel, and anything else to say. */
export default function FeedbackDialog({ state, onClose }: { state: GameState; onClose: (sent: boolean) => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const today = state.mode === 'daily';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) { setError('Pick a point on the scale first.'); return; }
    setBusy(true); setError('');
    try {
      await api('/api/feedback', { method: 'POST', json: { mode: state.mode, key: state.key, rating, comment } });
      setSent(true);
      setTimeout(() => onClose(true), 1100);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  // Arrow keys move along the scale, like a native radio group.
  const onKey = (e: React.KeyboardEvent) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = Math.min(RATING_LABELS.length, Math.max(1, (rating || 4) + step));
    setRating(next);
    (e.currentTarget.querySelector(`[data-value="${next}"]`) as HTMLElement | null)?.focus();
  };

  return (
    <Dialog title={today ? 'How was today’s thing?' : 'How was this one?'} onClose={() => onClose(false)}>
      {sent ? (
        <div className="py-6 text-center">
          <span className="stamp stamp-in green">Filed</span>
          <p className="muted mt-5 text-sm">Thank you — that helps make tomorrow’s case better.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <div>
            <p id="fb-scale" className="label muted">How difficult was it?</p>
            <div role="radiogroup" aria-labelledby="fb-scale" className="scale mt-2" onKeyDown={onKey}>
              {RATING_LABELS.map((label, i) => {
                const value = i + 1;
                const on = rating === value;
                return (
                  <button key={label} type="button" role="radio" aria-checked={on} aria-label={label} title={label} data-value={value}
                    tabIndex={on || (!rating && value === 4) ? 0 : -1}
                    className="scale-step" data-on={on ? 'yes' : 'no'} data-fill={rating >= value ? 'yes' : 'no'}
                    onClick={() => { setRating(value); setError(''); }}>
                    <span aria-hidden="true">{value}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-1.5 flex justify-between gap-3">
              <span className="label !text-[0.62rem]">Extremely easy</span>
              <span className="label text-right !text-[0.62rem]">Extremely hard</span>
            </div>
            <p className="typed mt-2 min-h-7 text-center text-lg" aria-live="polite">{rating ? RATING_LABELS[rating - 1] : ''}</p>
          </div>

          <div>
            <label htmlFor="fb-comment" className="label muted block">Anything to add? <span className="normal-case tracking-normal">(optional)</span></label>
            <textarea id="fb-comment" rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)}
              placeholder="Too obscure? Angle gave it away? Hints unhelpful? A thing you’d like to see?"
              className="mt-1.5 w-full resize-y border border-typeink/40 bg-white/30 p-2.5 text-[0.95rem] outline-none focus:border-stamp" />
          </div>

          {error && <p role="alert" className="text-sm font-bold text-stamp">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn btn-line" onClick={() => onClose(false)}>Not now</button>
            <button type="submit" className="btn btn-ink" disabled={busy}>{busy ? 'Sending…' : 'Send feedback'}</button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
