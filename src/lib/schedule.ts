// Daily schedule: one puzzle per calendar day in the game timezone.
import { db, today } from './db';
import { getAsset } from './assets';
import type { Asset, ScheduleEntry } from './types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isDate = (s: unknown): s is string => typeof s === 'string' && DATE_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

interface Row { date: string; asset_id: string; status: 'draft' | 'scheduled' }
const toEntry = (r: Row): ScheduleEntry => ({ date: r.date, assetId: r.asset_id, status: r.status });

export function listSchedule(from?: string, to?: string): ScheduleEntry[] {
  const rows = db().prepare('SELECT * FROM schedule WHERE date >= ? AND date <= ? ORDER BY date')
    .all(from ?? '0000-00-00', to ?? '9999-99-99') as unknown as Row[];
  return rows.map(toEntry);
}

export function setSchedule(date: string, assetId: string, status: 'draft' | 'scheduled'): ScheduleEntry {
  if (!isDate(date)) throw new Error('Invalid date');
  if (date < today()) throw new Error('Past puzzles are part of the archive and cannot be changed');
  const asset = getAsset(assetId);
  if (!asset) throw new Error('Asset not found');
  if (status === 'scheduled') {
    if (asset.status !== 'approved') throw new Error(`"${asset.meta.displayName}" must be approved before it can be scheduled`);
    if (asset.missing.length) throw new Error(`"${asset.meta.displayName}" still needs: ${asset.missing.join(', ')}`);
    if (asset.fileMissing) throw new Error('The model file is missing from the asset folder');
  } else if (status !== 'draft') throw new Error('Invalid status');
  db().prepare(`INSERT INTO schedule (date, asset_id, status) VALUES (?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET asset_id = excluded.asset_id, status = excluded.status`).run(date, assetId, status);
  return { date, assetId, status };
}

export function clearSchedule(date: string): void {
  if (!isDate(date)) throw new Error('Invalid date');
  if (date < today()) throw new Error('Past puzzles are part of the archive and cannot be removed');
  db().prepare('DELETE FROM schedule WHERE date = ?').run(date);
}

/** The published puzzle for a date, or null. Never returns drafts. */
export function puzzleFor(date: string): { asset: Asset; number: number } | null {
  const row = db().prepare("SELECT * FROM schedule WHERE date = ? AND status = 'scheduled'").get(date) as unknown as Row | undefined;
  if (!row) return null;
  const asset = getAsset(row.asset_id);
  if (!asset || asset.fileMissing) return null;
  if (date <= today() && (!asset.dateLastUsed || asset.dateLastUsed < date)) {
    db().prepare('UPDATE assets SET date_last_used = ? WHERE id = ?').run(date, asset.id);
    asset.dateLastUsed = date;
  }
  return { asset, number: puzzleNumber(date) };
}

/** Puzzle numbers count published days in order, so gaps never skip a number. */
export function puzzleNumber(date: string): number {
  const row = db().prepare("SELECT COUNT(*) AS n FROM schedule WHERE status = 'scheduled' AND date <= ?").get(date) as { n: number };
  return row.n;
}

/** Dates of every puzzle already released (up to and including `until`). */
export function releasedDates(until = today()): string[] {
  const rows = db().prepare("SELECT date FROM schedule WHERE status = 'scheduled' AND date <= ? ORDER BY date").all(until) as { date: string }[];
  return rows.map((r) => r.date);
}

/** True when the asset has been released to players (so its model may be served). */
export function isReleased(assetId: string): boolean {
  const row = db().prepare("SELECT 1 AS ok FROM schedule WHERE asset_id = ? AND status = 'scheduled' AND date <= ? LIMIT 1").get(assetId, today());
  return !!row;
}
