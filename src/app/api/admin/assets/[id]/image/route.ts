import fs from 'node:fs';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { handler } from '@/lib/auth';
import { PATHS } from '@/lib/db';

// GET ?kind=thumb | 0..3 -> generated thumbnail / silhouette preview (admin only: thumbnails are spoilers)
export const GET = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const kind = req.nextUrl.searchParams.get('kind') ?? 'thumb';
  if (!/^[0-9a-f]{12}$/.test(id) || !/^(thumb|[0-3])$/.test(kind)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const file = kind === 'thumb' ? path.join(PATHS.thumbnails, `${id}.png`) : path.join(PATHS.previews, `${id}-${kind}.png`);
  if (!fs.existsSync(file)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new NextResponse(new Uint8Array(fs.readFileSync(file)), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=86400' } });
}, { admin: true });
