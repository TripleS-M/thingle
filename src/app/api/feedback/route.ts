import type { NextRequest } from 'next/server';
import { handler, playerId } from '@/lib/auth';
import { submitFeedback } from '@/lib/feedback';
import type { GameMode } from '@/lib/types';

export const dynamic = 'force-dynamic';

// POST /api/feedback { mode, key, rating: 1..7, comment? } -> stores the player's view of a finished puzzle
export const POST = handler(async (req: NextRequest) => {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  submitFeedback(await playerId(), b.mode as GameMode, typeof b.key === 'string' ? b.key : null, b.rating, b.comment);
  return { ok: true };
});
