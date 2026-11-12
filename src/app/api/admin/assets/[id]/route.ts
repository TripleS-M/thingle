import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { handler } from '@/lib/auth';
import { deleteAsset, getAsset, updateAsset } from '@/lib/assets';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: NextRequest, ctx: Ctx) => {
  const asset = getAsset((await ctx.params).id);
  return asset ? { asset } : NextResponse.json({ error: 'Asset not found' }, { status: 404 });
}, { admin: true });

// PATCH { meta?, status? }
export const PATCH = handler(async (req: NextRequest, ctx: Ctx) => {
  const body = (await req.json()) as { meta?: Record<string, unknown>; status?: never };
  return { asset: updateAsset((await ctx.params).id, { meta: body.meta, status: body.status }) };
}, { admin: true });

// DELETE ?keepFile=1 -> removes the registry entry (and by default the model file)
export const DELETE = handler(async (req: NextRequest, ctx: Ctx) => {
  deleteAsset((await ctx.params).id, req.nextUrl.searchParams.get('keepFile') !== '1');
  return { ok: true };
}, { admin: true });
