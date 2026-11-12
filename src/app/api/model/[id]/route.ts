import fs from 'node:fs';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { getAsset, modelPath } from '@/lib/assets';
import { isReleased } from '@/lib/schedule';

export const dynamic = 'force-dynamic';

// Models are served by opaque id — never by filename — and only once the
// puzzle has been released (admins can load anything for previewing).
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const asset = /^[0-9a-f]{12}$/.test(id) ? getAsset(id) : null;
  if (!asset || !(isReleased(asset.id) || (await isAdmin()))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const file = modelPath(asset);
  if (!fs.existsSync(file)) return NextResponse.json({ error: 'Model file is missing' }, { status: 404 });
  const etag = `"${asset.hash.slice(0, 20)}"`;
  if (req.headers.get('if-none-match') === etag) return new NextResponse(null, { status: 304 });
  return new NextResponse(new Uint8Array(fs.readFileSync(file)), {
    headers: { 'Content-Type': 'model/gltf-binary', 'Cache-Control': 'private, max-age=3600', ETag: etag },
  });
}
