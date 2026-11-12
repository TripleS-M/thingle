'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';

export default function LoginForm({ devPassword, configured }: { devPassword: boolean; configured: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api('/api/admin/session', { method: 'POST', json: { password } });
      router.replace('/admin');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="paper rise w-full max-w-sm p-6 sm:p-8">
      <p className="label muted">Restricted · staff only</p>
      <h1 className="typed mt-1 text-2xl">Records room</h1>
      <p className="muted mt-2 text-sm">Sign in to manage the model library, configure cases and schedule the daily puzzle.</p>

      {!configured ? (
        <p className="mt-5 border-l-2 border-stamp pl-3 text-sm">
          No admin password is configured. Set <code>ADMIN_PASSWORD</code> in <code>.env.local</code> and restart the server.
        </p>
      ) : (
        <>
          <label htmlFor="password" className="label muted mt-6 block">Password</label>
          <input
            id="password"
            type="password"
            className="type-input mt-1 w-full"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />
          {error && <p role="alert" className="mt-3 text-sm text-stamp">{error}</p>}
          <button type="submit" className="btn btn-ink mt-6 w-full" disabled={busy || !password}>
            {busy ? 'Checking…' : 'Unlock'}
          </button>
          {devPassword && (
            <p className="muted mt-4 text-xs leading-relaxed">
              Development mode: no <code>ADMIN_PASSWORD</code> is set, so the password is <strong>shadowplay</strong>.
              Set a real one before deploying.
            </p>
          )}
        </>
      )}
    </form>
  );
}
