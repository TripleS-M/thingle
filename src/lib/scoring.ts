import type { HintType, PlayStatus, Scoring } from './types';

export const HINT_ORDER: HintType[] = ['category', 'function', 'rotation'];

export function computeScore(
  scoring: Scoring, status: PlayStatus, guessCount: number, hints: HintType[],
): number {
  if (status !== 'won') return 0;
  const base = scoring.guessPoints[guessCount - 1] ?? 0;
  const penalty = hints.reduce((sum, h) => sum + (scoring.hintCosts[h] ?? 0), 0);
  return Math.max(0, base - penalty);
}

export function maxScore(scoring: Scoring): number {
  return scoring.guessPoints[0] ?? 0;
}

/** Spoiler-free share text: one square per guess slot, lamps for hints. */
export function shareText(opts: {
  number: number | null; status: PlayStatus; guessCount: number; maxGuesses: number;
  hints: HintType[]; score: number; max: number; practice?: boolean;
}): string {
  const squares = Array.from({ length: opts.maxGuesses }, (_, i) => {
    if (opts.status === 'won' && i === opts.guessCount - 1) return '🟩';
    if (i < opts.guessCount) return '⬛';
    return '⬜';
  }).join('');
  const title = `THINGLE${opts.number ? ` #${String(opts.number).padStart(3, '0')}` : ''}${opts.practice ? ' (practice)' : ''}`;
  const verdict = opts.status === 'won' ? `${opts.guessCount}/${opts.maxGuesses}` : `X/${opts.maxGuesses}`;
  const hints = opts.hints.length ? `💡 ${opts.hints.length} hint${opts.hints.length > 1 ? 's' : ''}` : '💡 no hints';
  return `${title}\n${squares} ${verdict}\n${opts.score}/${opts.max} · ${hints}`;
}
