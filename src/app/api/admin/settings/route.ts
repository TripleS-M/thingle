import type { NextRequest } from 'next/server';
import { handler, usingDevPassword } from '@/lib/auth';
import { getSettings, isValidTimezone, saveSettings, today } from '@/lib/db';
import type { Settings } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => ({ settings: getSettings(), today: today(), devPassword: usingDevPassword() }), { admin: true });

export const PUT = handler(async (req: NextRequest) => {
  const b = (await req.json()) as Partial<Settings>;
  const cur = getSettings();
  const tz = String(b.timezone ?? cur.timezone).trim();
  if (!isValidTimezone(tz)) throw new Error(`"${tz}" is not a valid IANA timezone (example: Australia/Melbourne)`);
  const pts = (b.scoring?.guessPoints ?? cur.scoring.guessPoints).map((n) => Math.max(0, Math.round(Number(n) || 0)));
  if (pts.length !== 5) throw new Error('Exactly five guess scores are required (one per guess)');
  const cost = (k: 'category' | 'function' | 'rotation') =>
    Math.max(0, Math.round(Number(b.scoring?.hintCosts?.[k] ?? cur.scoring.hintCosts[k]) || 0));
  const next: Settings = {
    timezone: tz,
    scoring: { guessPoints: pts, hintCosts: { category: cost('category'), function: cost('function'), rotation: cost('rotation') } },
  };
  saveSettings(next);
  return { settings: next, today: today() };
}, { admin: true });
