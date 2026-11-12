// Game rules. All answer checking happens here on the server: the browser
// never receives the answer, the hints, or the model name until they are earned.
import { db, getSettings, today } from './db';
import { getAsset } from './assets';
import { isCorrect, normaliseAnswer } from './answers';
import { computeScore, HINT_ORDER, maxScore, shareText } from './scoring';
import { isDate, puzzleFor, releasedDates } from './schedule';
import type { Asset, GameMode, GameState, HintType, PlayerStats, PlayStatus } from './types';

export class GameError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

interface Puzzle { asset: Asset; number: number | null; date: string | null; key: string }
interface PlayRow { guesses: string; hints: string; status: PlayStatus; score: number }
interface Play { guesses: string[]; hints: HintType[]; status: PlayStatus; score: number }

function resolve(mode: GameMode, key: string | null, isAdmin: boolean): Puzzle | null {
  const now = today();
  if (mode === 'daily') {
    // A tab left open past midnight must not play yesterday's guess against today's puzzle.
    if (key && key !== now) throw new GameError('A new case has been filed since you opened this one. Reloading it now.', 409);
    const p = puzzleFor(now);
    return p && { ...p, date: now, key: now };
  }
  if (mode === 'practice') {
    if (!isDate(key) || key >= now) throw new GameError('That puzzle has not been released yet', 403);
    const p = puzzleFor(key);
    return p && { ...p, date: key, key };
  }
  if (mode === 'preview') {
    if (!isAdmin) throw new GameError('Admin sign-in required', 401);
    if (isDate(key)) { // development mode: test an upcoming scheduled (or draft) day
      const row = db().prepare('SELECT asset_id FROM schedule WHERE date = ?').get(key) as { asset_id: string } | undefined;
      const asset = row && getAsset(row.asset_id);
      return asset ? { asset, number: null, date: key, key } : null;
    }
    const asset = key ? getAsset(key) : null;
    return asset && { asset, number: null, date: null, key: asset.id };
  }
  throw new GameError('Unknown mode');
}

function loadPlay(playerId: string, mode: GameMode, key: string): Play {
  const row = db().prepare('SELECT guesses, hints, status, score FROM plays WHERE player_id = ? AND mode = ? AND key = ?')
    .get(playerId, mode, key) as unknown as PlayRow | undefined;
  if (!row) return { guesses: [], hints: [], status: 'playing', score: 0 };
  return { guesses: JSON.parse(row.guesses), hints: JSON.parse(row.hints), status: row.status, score: row.score };
}

function savePlay(playerId: string, mode: GameMode, puzzle: Puzzle, play: Play): void {
  const now = new Date().toISOString();
  db().prepare('INSERT OR IGNORE INTO players (id, created_at) VALUES (?, ?)').run(playerId, now);
  db().prepare(`INSERT INTO plays (player_id, mode, key, asset_id, guesses, hints, status, score, started_at, finished_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(player_id, mode, key) DO UPDATE SET guesses = excluded.guesses, hints = excluded.hints,
      status = excluded.status, score = excluded.score, finished_at = excluded.finished_at`)
    .run(playerId, mode, puzzle.key, puzzle.asset.id, JSON.stringify(play.guesses), JSON.stringify(play.hints),
      play.status, play.score, now, play.status === 'playing' ? null : now);
}

function toState(mode: GameMode, puzzle: Puzzle, play: Play): GameState {
  const { asset } = puzzle;
  const { scoring } = getSettings();
  const m = asset.meta;
  const maxGuesses = scoring.guessPoints.length;
  const done = play.status !== 'playing';
  return {
    mode, key: puzzle.key, number: puzzle.number, date: puzzle.date, difficulty: m.difficulty,
    model: `/api/model/${asset.id}`,
    camera: m.camera, rotation: m.rotation, shadow: m.shadow,
    maxGuesses, guesses: play.guesses, status: play.status,
    hints: {
      category: play.hints.includes('category') ? (m.hint1 || m.category) : null,
      function: play.hints.includes('function') ? m.hint2 : null,
      rotation: play.hints.includes('rotation'),
    },
    scoring,
    result: done ? {
      answer: m.answer, description: m.description, category: m.category,
      score: play.score, maxScore: maxScore(scoring),
      share: shareText({
        number: puzzle.number, status: play.status, guessCount: play.guesses.length, maxGuesses,
        hints: play.hints, score: play.score, max: maxScore(scoring), practice: mode !== 'daily',
      }),
      credit: { creator: m.creator, licence: m.licence, sourceSite: m.sourceSite, sourceUrl: m.sourceUrl, attribution: m.attribution },
    } : null,
  };
}

export function getState(playerId: string, mode: GameMode, key: string | null, isAdmin: boolean): GameState | null {
  const puzzle = resolve(mode, key, isAdmin);
  return puzzle ? toState(mode, puzzle, loadPlay(playerId, mode, puzzle.key)) : null;
}

function requirePuzzle(mode: GameMode, key: string | null, isAdmin: boolean): Puzzle {
  const puzzle = resolve(mode, key, isAdmin);
  if (!puzzle) throw new GameError('No puzzle is available', 404);
  return puzzle;
}

export function submitGuess(playerId: string, mode: GameMode, key: string | null, raw: string, isAdmin: boolean):
  { state: GameState; correct: boolean; message: string } {
  const puzzle = requirePuzzle(mode, key, isAdmin);
  const play = loadPlay(playerId, mode, puzzle.key);
  if (play.status !== 'playing') throw new GameError('This puzzle is already finished');
  const guess = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!normaliseAnswer(guess)) throw new GameError('Type a guess first');
  if (play.guesses.some((g) => normaliseAnswer(g) === normaliseAnswer(guess))) {
    throw new GameError('You have already tried that — it did not cost you a guess');
  }
  const { scoring } = getSettings();
  const correct = isCorrect(guess, puzzle.asset.meta.answer, puzzle.asset.meta.accepted);
  play.guesses.push(guess);
  if (correct) play.status = 'won';
  else if (play.guesses.length >= scoring.guessPoints.length) play.status = 'lost';
  play.score = computeScore(scoring, play.status, play.guesses.length, play.hints);
  savePlay(playerId, mode, puzzle, play);
  const message = correct ? 'Case closed.' : play.status === 'lost' ? 'Out of guesses.' : 'Not quite. Take another look.';
  return { state: toState(mode, puzzle, play), correct, message };
}

export function useHint(playerId: string, mode: GameMode, key: string | null, type: HintType, isAdmin: boolean): GameState {
  if (!HINT_ORDER.includes(type)) throw new GameError('Unknown hint');
  const puzzle = requirePuzzle(mode, key, isAdmin);
  const play = loadPlay(playerId, mode, puzzle.key);
  if (play.status !== 'playing') throw new GameError('This puzzle is already finished');
  if (!play.hints.includes(type)) { // each hint can be used once; repeats are free no-ops
    play.hints.push(type);
    savePlay(playerId, mode, puzzle, play);
  }
  return toState(mode, puzzle, play);
}

export function resetPlay(playerId: string, mode: GameMode, key: string | null): void {
  if (mode === 'daily') throw new GameError('Daily puzzles cannot be reset', 403);
  db().prepare('DELETE FROM plays WHERE player_id = ? AND mode = ? AND key = ?').run(playerId, mode, key ?? '');
}

/** Archive listing: every released puzzle before today, with this player's results. */
export function archive(playerId: string): { date: string; number: number; difficulty: string; daily: PlayStatus | null; practice: PlayStatus | null; score: number | null }[] {
  const now = today();
  const dates = releasedDates(now).filter((d) => d < now);
  const rows = db().prepare("SELECT mode, key, status, score FROM plays WHERE player_id = ? AND mode IN ('daily', 'practice')")
    .all(playerId) as { mode: string; key: string; status: PlayStatus; score: number }[];
  const find = (mode: string, date: string) => rows.find((r) => r.mode === mode && r.key === date);
  const diff = new Map((db().prepare("SELECT s.date AS date, a.meta AS meta FROM schedule s JOIN assets a ON a.id = s.asset_id WHERE s.status = 'scheduled'")
    .all() as { date: string; meta: string }[]).map((r) => [r.date, JSON.parse(r.meta).difficulty as string]));
  return dates.map((date, i) => {
    const d = find('daily', date), p = find('practice', date);
    const finished = d && d.status !== 'playing' ? d : p && p.status !== 'playing' ? p : null;
    return { date, number: i + 1, difficulty: diff.get(date) ?? 'hard', daily: d?.status ?? null, practice: p?.status ?? null, score: finished?.score ?? null };
  }).reverse();
}

export function playerStats(playerId: string): PlayerStats {
  const { scoring } = getSettings();
  const rows = db().prepare("SELECT key, guesses, hints, status, score FROM plays WHERE player_id = ? AND mode = 'daily' AND status != 'playing'")
    .all(playerId) as { key: string; guesses: string; hints: string; status: PlayStatus; score: number }[];
  const byDate = new Map(rows.map((r) => [r.key, r]));
  const hintCounts: Record<HintType, number> = { category: 0, function: 0, rotation: 0 };
  const distribution = new Array(scoring.guessPoints.length + 1).fill(0);
  let won = 0, guessSum = 0, scoreSum = 0;
  for (const r of rows) {
    const guesses = (JSON.parse(r.guesses) as string[]).length;
    for (const h of JSON.parse(r.hints) as HintType[]) hintCounts[h]++;
    scoreSum += r.score;
    if (r.status === 'won') { won++; guessSum += guesses; distribution[Math.min(guesses, distribution.length - 1) - 1]++; }
    else distribution[distribution.length - 1]++;
  }
  // Streaks follow the sequence of published puzzles, so a day with no puzzle never breaks one.
  const now = today();
  let maxStreak = 0, run = 0;
  for (const d of releasedDates(now)) {
    const r = byDate.get(d);
    if (r?.status === 'won') { run++; maxStreak = Math.max(maxStreak, run); }
    else if (d !== now || r) run = 0; // today's unfinished puzzle doesn't break the streak
  }
  const totalHints = hintCounts.category + hintCounts.function + hintCounts.rotation;
  const top = HINT_ORDER.reduce((a, b) => (hintCounts[b] > hintCounts[a] ? b : a));
  return {
    played: rows.length, won, winPct: rows.length ? Math.round((won / rows.length) * 100) : 0,
    currentStreak: run, maxStreak,
    avgGuesses: won ? Math.round((guessSum / won) * 10) / 10 : 0,
    avgScore: rows.length ? Math.round(scoreSum / rows.length) : 0,
    totalHints, hintCounts, mostUsedHint: totalHints ? top : null, distribution,
  };
}
