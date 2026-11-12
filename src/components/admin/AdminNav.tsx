'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/client';

const LINKS = [
  { href: '/admin', label: 'Library', match: (p: string) => p === '/admin' || p.startsWith('/admin/assets') },
  { href: '/admin/schedule', label: 'Schedule', match: (p: string) => p.startsWith('/admin/schedule') },
  { href: '/admin/feedback', label: 'Feedback', match: (p: string) => p.startsWith('/admin/feedback') },
  { href: '/admin/settings', label: 'Settings', match: (p: string) => p.startsWith('/admin/settings') },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const signOut = async () => {
    await api('/api/admin/session', { method: 'DELETE' }).catch(() => null);
    router.replace('/admin/login');
    router.refresh();
  };
  return (
    <header className="border-b border-brass/25 bg-walnut-950/70">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3">
        <Link href="/admin" className="flex items-baseline gap-3">
          <span className="wordmark text-xl leading-none">Thingle</span>
          <span className="label text-smoke">Records room</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1.5" aria-label="Admin">
          {LINKS.map((l) => {
            const active = l.match(pathname);
            return (
              <Link key={l.href} href={l.href} aria-current={active ? 'page' : undefined} className={`btn btn-sm ${active ? 'btn-brass' : 'btn-ghost'}`}>
                {l.label}
              </Link>
            );
          })}
          <span className="mx-1 hidden h-5 w-px bg-brass/30 sm:block" />
          <Link href="/" className="btn btn-ghost btn-sm">View game</Link>
          <button type="button" className="btn btn-ghost btn-sm" onClick={signOut}>Sign out</button>
        </nav>
      </div>
    </header>
  );
}
