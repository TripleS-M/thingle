import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { adminLogin, adminLogout, handler } from '@/lib/auth';

export const POST = handler(async (req: NextRequest) => {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  const res = await adminLogin(password ?? '', ip);
  return res.ok ? { ok: true } : NextResponse.json({ error: res.error }, { status: 401 });
});

export const DELETE = handler(async () => { await adminLogout(); return { ok: true }; });
