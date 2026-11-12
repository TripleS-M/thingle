// Player feedback: how hard a puzzle felt (1–7) plus an optional comment,
// stored with the outcome so it can be analysed by day or by object later.
import { db } from './db';
import { GameError } from './game';
import { isDate } from './schedule';
import { RATING_LABELS, type GameMode, type PlayStatus } from './types';

export { RATING_LABELS };

export interface FeedbackRow {
  id: number;
  date: string;
  mode: 'daily' | 'practice';
  assetId: string;
  thing: string;
  rating: number;
  comment: string;
  outcome: 'won' | 'lost';
  guesses: number;
  hints: string[];
  score: number;
  createdAt: string;
}

export interface FeedbackSummary {
  date: string;
  assetId: string;
  thing: string;
  responses: number;
  avgRating: number;
  distribution: number[]; // count per rating 1..7
  solved: number;         // how many of the respondents solved it
  avgGuesses: number;     // among those who solved it
  avgScore: number;
  comments: number;
}

export function submitFeedback(playerId: string, mode: GameMode, key: string | null, rating: unknown, comment: unknown): void {
  if (mode !== 'daily' && mode !== 'practice') throw new GameError('Feedback is only collected for real games');
  if (!isDate(key)) throw new GameError('Unknown puzzle');
  const r = Math.round(Number(rating));
  if (!(r >= 1 && r <= RATING_LABELS.length)) throw new GameError('Pick how difficult it was first');
  const play = db().prepare('SELECT asset_id, guesses, hints, status, score FROM plays WHERE player_id = ? AND mode = ? AND key = ?')
    .get(playerId, mode, key) as { asset_id: string; guesses: string; hints: string; status: PlayStatus; score: number } | undefined;
  if (!play || play.status === 'playing') throw new GameError('Finish the case before leaving feedback');
  const asset = db().prepare('SELECT meta FROM assets WHERE id = ?').get(play.asset_id) as { meta: string } | undefined;
  const thing = asset ? String((JSON.parse(asset.meta) as { answer?: string }).answer ?? '') : '';
  const text = typeof comment === 'string' ? comment.replace(/\s+/g, ' ').trim().slice(0, 1000) : '';
  db().prepare(`INSERT INTO feedback (player_id, mode, date, asset_id, thing, rating, comment, outcome, guesses, hints, score, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(player_id, mode, date) DO UPDATE SET rating = excluded.rating, comment = excluded.comment, created_at = excluded.created_at`)
    .run(playerId, mode, key, play.asset_id, thing, r, text, play.status, (JSON.parse(play.guesses) as string[]).length,
      play.hints, play.score, new Date().toISOString());
}

interface Raw {
  id: number; date: string; mode: 'daily' | 'practice'; asset_id: string; thing: string; rating: number; comment: string;
  outcome: 'won' | 'lost'; guesses: number; hints: string; score: number; created_at: string;
}

export interface FeedbackFilter { from?: string; to?: string; assetId?: string; mode?: string }

export function listFeedback(filter: FeedbackFilter = {}): FeedbackRow[] {
  const where: string[] = [], args: string[] = [];
  if (isDate(filter.from)) { where.push('date >= ?'); args.push(filter.from); }
  if (isDate(filter.to)) { where.push('date <= ?'); args.push(filter.to); }
  if (filter.assetId) { where.push('asset_id = ?'); args.push(filter.assetId); }
  if (filter.mode === 'daily' || filter.mode === 'practice') { where.push('mode = ?'); args.push(filter.mode); }
  const rows = db().prepare(`SELECT * FROM feedback ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY date DESC, created_at DESC`)
    .all(...args) as unknown as Raw[];
  return rows.map((r) => ({
    id: r.id, date: r.date, mode: r.mode, assetId: r.asset_id, thing: r.thing, rating: r.rating, comment: r.comment,
    outcome: r.outcome, guesses: r.guesses, hints: JSON.parse(r.hints) as string[], score: r.score, createdAt: r.created_at,
  }));
}

/** One line per puzzle day + object, newest first. */
export function summarise(rows: FeedbackRow[]): FeedbackSummary[] {
  const groups = new Map<string, FeedbackRow[]>();
  for (const r of rows) {
    const k = `${r.date}|${r.assetId}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const round = (n: number) => Math.round(n * 10) / 10;
  return [...groups.values()].map((g) => {
    const solved = g.filter((r) => r.outcome === 'won');
    const distribution = RATING_LABELS.map((_, i) => g.filter((r) => r.rating === i + 1).length);
    return {
      date: g[0].date, assetId: g[0].assetId, thing: g[0].thing, responses: g.length,
      avgRating: round(g.reduce((s, r) => s + r.rating, 0) / g.length), distribution,
      solved: solved.length,
      avgGuesses: solved.length ? round(solved.reduce((s, r) => s + r.guesses, 0) / solved.length) : 0,
      avgScore: Math.round(g.reduce((s, r) => s + r.score, 0) / g.length),
      comments: g.filter((r) => r.comment).length,
    };
  }).sort((a, b) => b.date.localeCompare(a.date));
}

/** Every object that has feedback, for the filter menu. */
export function feedbackThings(): { assetId: string; thing: string }[] {
  return (db().prepare('SELECT asset_id AS assetId, MAX(thing) AS thing FROM feedback GROUP BY asset_id ORDER BY thing').all() as { assetId: string; thing: string }[]);
}

const csvCell = (v: unknown) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stop spreadsheets treating player text as a formula
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function toCsv(rows: FeedbackRow[]): string {
  const head = ['date', 'mode', 'thing', 'asset_id', 'rating', 'rating_label', 'outcome', 'guesses', 'hints_used', 'score', 'comment', 'submitted_at'];
  const lines = rows.map((r) => [r.date, r.mode, r.thing, r.assetId, r.rating, RATING_LABELS[r.rating - 1], r.outcome, r.guesses,
    r.hints.join(' '), r.score, r.comment, r.createdAt].map(csvCell).join(','));
  return [head.join(','), ...lines].join('\r\n');
}
