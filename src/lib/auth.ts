// Cookies: an anonymous player id, and a signed admin session.
// (Imports next/headers — do not import this file from CLI scripts.)
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { GameError } from './game';

const PLAYER_COOKIE = 'sp_player';
const ADMIN_COOKIE = 'sp_admin';
const ADMIN_TTL = 60 * 60 * 12; // seconds
const secure = process.env.NODE_ENV === 'production';

const DEV_PASSWORD = 'shadowplay';
export function adminPassword(): string | null {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  return process.env.NODE_ENV === 'production' ? null : DEV_PASSWORD; // never fall back in production
}
export const usingDevPassword = () => !process.env.ADMIN_PASSWORD && process.env.NODE_ENV !== 'production';

function secret(): string {
  return process.env.ADMIN_SECRET || crypto.createHash('sha256').update(`shadowplay:${adminPassword() ?? crypto.randomUUID()}`).digest('hex');
}
const sign = (payload: string) => crypto.createHmac('sha256', secret()).update(payload).digest('hex');
const safeEqual = (a: string, b: string) => {
  const x = crypto.createHash('sha256').update(a).digest(), y = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(x, y);
};

/** Returns the anonymous player id, creating the cookie on first visit. */
export async function playerId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(PLAYER_COOKIE)?.value;
  if (existing && /^[0-9a-f-]{36}$/.test(existing)) return existing;
  const id = crypto.randomUUID();
  jar.set(PLAYER_COOKIE, id, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 60 * 60 * 24 * 730 });
  return id;
}

/** Read-only variant for server components (which cannot set cookies). */
export async function existingPlayerId(): Promise<string | null> {
  const v = (await cookies()).get(PLAYER_COOKIE)?.value;
  return v && /^[0-9a-f-]{36}$/.test(v) ? v : null;
}

export async function isAdmin(): Promise<boolean> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  return safeEqual(sig, sign(`admin:${exp}`));
}

const attempts = new Map<string, { n: number; reset: number }>();

export async function adminLogin(password: string, ip: string): Promise<{ ok: boolean; error?: string }> {
  const expected = adminPassword();
  if (!expected) return { ok: false, error: 'ADMIN_PASSWORD is not set on the server. Add it to .env.local and restart.' };
  const now = Date.now(), a = attempts.get(ip);
  if (a && a.reset > now && a.n >= 8) return { ok: false, error: 'Too many attempts. Try again in a few minutes.' };
  if (!safeEqual(String(password ?? ''), expected)) {
    attempts.set(ip, a && a.reset > now ? { n: a.n + 1, reset: a.reset } : { n: 1, reset: now + 10 * 60_000 });
    return { ok: false, error: 'Wrong password.' };
  }
  attempts.delete(ip);
  const exp = Math.floor(now / 1000) + ADMIN_TTL;
  (await cookies()).set(ADMIN_COOKIE, `${exp}.${sign(`admin:${exp}`)}`, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: ADMIN_TTL });
  return { ok: true };
}

export async function adminLogout(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}

/** Wrap an API handler: JSON errors, and optional admin gate. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response | object>, opts: { admin?: boolean } = {}) {
  return async (...args: A): Promise<Response> => {
    try {
      if (opts.admin && !(await isAdmin())) return NextResponse.json({ error: 'Admin sign-in required' }, { status: 401 });
      const out = await fn(...args);
      return out instanceof Response ? out : NextResponse.json(out);
    } catch (e) {
      if (e instanceof GameError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error('[shadowplay]', e);
      // Admin tools get the real validation message; players get a generic one.
      const message = opts.admin ? (e as Error).message || 'Something went wrong' : 'Something went wrong';
      return NextResponse.json({ error: message }, { status: opts.admin ? 400 : 500 });
    }
  };
}
