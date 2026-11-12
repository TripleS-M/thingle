import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { handler } from '@/lib/auth';
import { getAsset } from '@/lib/assets';
import { exposureAt } from '@/lib/ingest';

// GET ?az=&el=&roll= -> how revealing this viewing angle is (0 slimmest .. 1 broadest profile)
export const GET = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const asset = getAsset((await ctx.params).id);
  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  const q = req.nextUrl.searchParams;
  return exposureAt(asset, { az: Number(q.get('az')) || 0, el: Number(q.get('el')) || 0, roll: Number(q.get('roll')) || 0, zoom: 1 });
}, { admin: true });
