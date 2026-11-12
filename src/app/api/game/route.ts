import type { NextRequest } from 'next/server';
import { handler, isAdmin, playerId } from '@/lib/auth';
import { getSettings } from '@/lib/db';
import { GameError, getState, resetPlay, submitGuess, useHint } from '@/lib/game';
import type { GameMode } from '@/lib/types';

export const dynamic = 'force-dynamic';

const MODES: GameMode[] = ['daily', 'practice', 'preview'];
function parseMode(v: unknown): GameMode {
  if (!MODES.includes(v as GameMode)) throw new GameError('Unknown mode');
  return v as GameMode;
}

// GET /api/game?mode=daily|practice|preview&key=... -> current puzzle state (or { state: null })
export const GET = handler(async (req: NextRequest) => {
  const q = req.nextUrl.searchParams;
  const mode = parseMode(q.get('mode') ?? 'daily');
  const state = getState(await playerId(), mode, q.get('key'), mode === 'preview' && (await isAdmin()));
  return { state, timezone: getSettings().timezone };
});

// POST /api/game { action: 'guess' | 'hint' | 'reset', mode, key, guess?, hint? }
export const POST = handler(async (req: NextRequest) => {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const mode = parseMode(body.mode ?? 'daily');
  const key = typeof body.key === 'string' ? body.key : null;
  const pid = await playerId();
  const admin = mode === 'preview' && (await isAdmin());
  switch (body.action) {
    case 'guess': return submitGuess(pid, mode, key, String(body.guess ?? ''), admin);
    case 'hint': return { state: useHint(pid, mode, key, body.hint as never, admin) };
    case 'reset': resetPlay(pid, mode, key); return { state: getState(pid, mode, key, admin) };
    default: throw new GameError('Unknown action');
  }
});
