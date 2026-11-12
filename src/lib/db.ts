// SQLite storage using Node's built-in `node:sqlite` (no native dependencies).
// `process.getBuiltinModule` keeps bundlers from trying to resolve the module.
import path from 'node:path';
import fs from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import { DEFAULT_SETTINGS, type Settings } from './types';

export const ROOT = process.env.SHADOWPLAY_ROOT || process.cwd();
export const PATHS = {
  library: path.join(ROOT, 'assets', 'shadowplay'),
  thumbnails: path.join(ROOT, 'storage', 'shadowplay', 'thumbnails'),
  previews: path.join(ROOT, 'storage', 'shadowplay', 'previews'),
  processed: path.join(ROOT, 'storage', 'shadowplay', 'processed'),
  data: path.join(ROOT, 'data'),
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  hash TEXT NOT NULL UNIQUE,
  file TEXT NOT NULL,
  format TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'review',
  meta TEXT NOT NULL,
  stats TEXT NOT NULL,
  date_added TEXT NOT NULL,
  date_last_used TEXT,
  file_missing INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS schedule (
  date TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft'
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
-- Anonymous players today; add account columns (email, auth provider) later.
CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS plays (
  player_id TEXT NOT NULL,
  mode TEXT NOT NULL,            -- daily | practice | preview
  key TEXT NOT NULL,             -- puzzle date, or asset id for previews
  asset_id TEXT NOT NULL,
  guesses TEXT NOT NULL DEFAULT '[]',
  hints TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'playing',
  score INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  PRIMARY KEY (player_id, mode, key)
);
CREATE INDEX IF NOT EXISTS plays_by_puzzle ON plays (mode, key, score);
`;

const g = globalThis as unknown as { __shadowplayDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (g.__shadowplayDb) return g.__shadowplayDb;
  const sqlite = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');
  for (const dir of Object.values(PATHS)) fs.mkdirSync(dir, { recursive: true });
  const conn = new sqlite.DatabaseSync(process.env.SHADOWPLAY_DB || path.join(PATHS.data, 'shadowplay.db'));
  conn.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 4000;');
  conn.exec(SCHEMA);
  g.__shadowplayDb = conn;
  return conn;
}

export function getSettings(): Settings {
  const row = db().prepare('SELECT value FROM settings WHERE key = ?').get('settings') as { value: string } | undefined;
  if (!row) return structuredClone(DEFAULT_SETTINGS);
  const saved = JSON.parse(row.value) as Partial<Settings>;
  return {
    timezone: saved.timezone || DEFAULT_SETTINGS.timezone,
    scoring: {
      guessPoints: saved.scoring?.guessPoints?.length ? saved.scoring.guessPoints : DEFAULT_SETTINGS.scoring.guessPoints,
      hintCosts: { ...DEFAULT_SETTINGS.scoring.hintCosts, ...saved.scoring?.hintCosts },
    },
  };
}

export function saveSettings(next: Settings): void {
  db().prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run('settings', JSON.stringify(next));
}

/** Today's date (YYYY-MM-DD) in the configured game timezone. */
export function today(tz = getSettings().timezone, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function isValidTimezone(tz: string): boolean {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; }
}
