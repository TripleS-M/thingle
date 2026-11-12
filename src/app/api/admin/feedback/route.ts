import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { handler } from '@/lib/auth';
import { feedbackThings, listFeedback, RATING_LABELS, summarise, toCsv } from '@/lib/feedback';

export const dynamic = 'force-dynamic';

// GET ?from=&to=&asset=&mode=&format=csv -> player feedback, filterable by day and by object
export const GET = handler(async (req: NextRequest) => {
  const q = req.nextUrl.searchParams;
  const rows = listFeedback({
    from: q.get('from') ?? undefined, to: q.get('to') ?? undefined,
    assetId: q.get('asset') ?? undefined, mode: q.get('mode') ?? undefined,
  });
  if (q.get('format') === 'csv') {
    return new NextResponse(`﻿${toCsv(rows)}`, {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="thingle-feedback.csv"' },
    });
  }
  return { rows, summary: summarise(rows), things: feedbackThings(), labels: RATING_LABELS };
}, { admin: true });
