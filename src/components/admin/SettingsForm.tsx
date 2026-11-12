'use client';

import { useEffect, useState } from 'react';
import { api, formatDate } from '@/lib/client';
import type { HintType, Settings } from '@/lib/types';

const ORDINAL = ['First', 'Second', 'Third', 'Fourth', 'Fifth'];
const HINTS: { key: HintType; label: string }[] = [
  { key: 'category', label: 'Category reveal' },
  { key: 'function', label: 'Function clue' },
  { key: 'rotation', label: 'Rotation' },
];
const ZONES = ['Australia/Melbourne', 'Australia/Sydney', 'Australia/Perth', 'Pacific/Auckland', 'Asia/Tokyo', 'Asia/Kolkata', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'UTC'];

export default function SettingsForm() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [today, setToday] = useState('');
  const [devPassword, setDevPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    api<{ settings: Settings; today: string; devPassword: boolean }>('/api/admin/settings')
      .then((r) => { setSettings(r.settings); setToday(r.today); setDevPassword(r.devPassword); })
      .catch((e) => setError((e as Error).message));
  }, []);

  if (!settings) return error
    ? <p role="alert" className="panel p-4 text-sm text-stamp-hi">{error}</p>
    : <p className="label py-20 text-center text-smoke"><span className="pulse-dot">●</span> Loading…</p>;

  const { scoring } = settings;
  const num = (v: string) => Math.max(0, Math.round(Number(v) || 0));
  const setPoint = (i: number, v: string) => setSettings({ ...settings, scoring: { ...scoring, guessPoints: scoring.guessPoints.map((p, j) => (j === i ? num(v) : p)) } });
  const setCost = (k: HintType, v: string) => setSettings({ ...settings, scoring: { ...scoring, hintCosts: { ...scoring.hintCosts, [k]: num(v) } } });
  const allHints = scoring.hintCosts.category + scoring.hintCosts.function + scoring.hintCosts.rotation;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      const r = await api<{ settings: Settings; today: string }>('/api/admin/settings', { method: 'PUT', json: settings });
      setSettings(r.settings); setToday(r.today); setNotice('Settings saved.');
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  };

  return (
    <form onSubmit={save} className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="typed text-2xl text-paper">Settings</h1>
        <p className="mt-1 text-sm text-smoke">Game-wide rules. Changes apply to games finished from now on; scores already recorded are not rewritten.</p>
      </div>
      {error && <p role="alert" className="panel border-stamp-hi/60 p-3 text-sm text-stamp-hi">{error}</p>}
      {notice && <p role="status" className="panel border-banker-hi/50 p-3 text-sm text-banker-hi">{notice}</p>}

      <section className="panel space-y-3 p-4">
        <h2 className="typed text-lg text-brass-hi">Daily changeover</h2>
        <label className="block max-w-sm">
          <span className="field-label">Timezone (IANA name)</span>
          <input className="field" list="zones" value={settings.timezone} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} required />
          <datalist id="zones">{ZONES.map((z) => <option key={z} value={z} />)}</datalist>
        </label>
        <p className="text-sm text-smoke">The case changes at midnight in this timezone for every player. It is currently <span className="text-paper">{formatDate(today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span> there.</p>
        <p className="text-xs text-[#e39a4c]">Changing the timezone moves “today”, which can shift which scheduled case is live. Check the schedule afterwards.</p>
      </section>

      <section className="panel space-y-3 p-4">
        <h2 className="typed text-lg text-brass-hi">Points for solving</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {scoring.guessPoints.map((p, i) => (
            <label key={i}>
              <span className="field-label">{ORDINAL[i]} guess</span>
              <input type="number" min={0} step={10} className="field tabular-nums" value={p} onChange={(e) => setPoint(i, e.target.value)} />
            </label>
          ))}
        </div>
        <p className="text-sm text-smoke">Failing all five guesses always scores 0. There is no speed bonus.</p>
      </section>

      <section className="panel space-y-3 p-4">
        <h2 className="typed text-lg text-brass-hi">Hint costs</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {HINTS.map((h) => (
            <label key={h.key}>
              <span className="field-label">{h.label}</span>
              <input type="number" min={0} step={10} className="field tabular-nums" value={scoring.hintCosts[h.key]} onChange={(e) => setCost(h.key, e.target.value)} />
            </label>
          ))}
        </div>
        <p className="text-sm text-smoke">
          Deducted from the final score, never below 0. Example: solved on the second guess with every hint = {scoring.guessPoints[1]} − {allHints} ={' '}
          <span className="text-paper">{Math.max(0, scoring.guessPoints[1] - allHints)}</span> points.
        </p>
      </section>

      <div className="flex justify-end"><button type="submit" className="btn btn-brass" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button></div>

      <section className="panel space-y-2 p-4 text-sm text-smoke">
        <h2 className="typed text-lg text-brass-hi">Admin access</h2>
        {devPassword
          ? <p className="text-[#e39a4c]">Running with the development password (“shadowplay”). Set <code>ADMIN_PASSWORD</code> and <code>ADMIN_SECRET</code> in <code>.env.local</code> before deploying — in production the records room stays locked until a password is set.</p>
          : <p>The admin password comes from the <code>ADMIN_PASSWORD</code> environment variable. Sessions last 12 hours.</p>}
      </section>
    </form>
  );
}
