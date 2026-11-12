import type { NextRequest } from 'next/server';
import { handler } from '@/lib/auth';
import { getSettings, today } from '@/lib/db';
import { clearSchedule, listSchedule, setSchedule } from '@/lib/schedule';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: NextRequest) => {
  const q = req.nextUrl.searchParams;
  return { today: today(), timezone: getSettings().timezone, entries: listSchedule(q.get('from') ?? undefined, q.get('to') ?? undefined) };
}, { admin: true });

// PUT { date, assetId, status: 'draft' | 'scheduled' }
export const PUT = handler(async (req: NextRequest) => {
  const b = (await req.json()) as { date: string; assetId: string; status: 'draft' | 'scheduled' };
  return { entry: setSchedule(b.date, b.assetId, b.status ?? 'draft') };
}, { admin: true });

export const DELETE = handler(async (req: NextRequest) => {
  clearSchedule(req.nextUrl.searchParams.get('date') ?? '');
  return { ok: true };
}, { admin: true });
