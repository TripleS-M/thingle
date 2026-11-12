'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Dialog from '@/components/Dialog';
import { api, formatDate } from '@/lib/client';
import type { Asset, ScheduleEntry } from '@/lib/types';

const addDays = (date: string, n: number) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const weekday = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ScheduleBoard() {
  const [today, setToday] = useState('');
  const [timezone, setTimezone] = useState('');
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [weeks, setWeeks] = useState(8);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([
        api<{ today: string; timezone: string; entries: ScheduleEntry[] }>('/api/admin/schedule'),
        api<{ assets: Asset[] }>('/api/admin/assets'),
      ]);
      setToday(s.today); setTimezone(s.timezone); setEntries(s.entries); setAssets(a.assets);
      setReady(true);
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const byDate = useMemo(() => new Map(entries.map((e) => [e.date, e])), [entries]);
  const byId = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const start = today ? addDays(today, -weekday(today) - 7) : ''; // show last week for context
  const days = useMemo(() => (start ? Array.from({ length: (weeks + 1) * 7 }, (_, i) => addDays(start, i)) : []), [start, weeks]);
  const end = days[days.length - 1] ?? '';

  const run = async (fn: () => Promise<unknown>, done = '') => {
    setBusy(true); setError(''); setNotice('');
    try { await fn(); await load(); setNotice(done); return true; }
    catch (e) { setError((e as Error).message); return false; }
    finally { setBusy(false); }
  };
  const assign = (date: string, assetId: string, status: 'draft' | 'scheduled') =>
    run(() => api('/api/admin/schedule', { method: 'PUT', json: { date, assetId, status } }));
  const clear = (date: string) => run(() => api(`/api/admin/schedule?date=${date}`, { method: 'DELETE' }));

  // Approved models that are not on the calendar anywhere, oldest first.
  const unused = useMemo(() => assets.filter((a) => a.status === 'approved' && !a.missing.length && !a.fileMissing && a.scheduled.length === 0)
    .sort((a, b) => a.dateAdded.localeCompare(b.dateAdded)), [assets]);
  const emptyDays = days.filter((d) => d >= today && !byDate.has(d));
  const drafts = entries.filter((e) => e.date >= today && e.status === 'draft');
  const publishable = drafts.filter((e) => { const a = byId.get(e.assetId); return a && a.status === 'approved' && !a.missing.length && !a.fileMissing; });

  const autoFill = () => run(async () => {
    const n = Math.min(unused.length, emptyDays.length);
    for (let i = 0; i < n; i++) await api('/api/admin/schedule', { method: 'PUT', json: { date: emptyDays[i], assetId: unused[i].id, status: 'draft' } });
  }, `Pencilled ${Math.min(unused.length, emptyDays.length)} unused model(s) into empty days as drafts. Nothing is published until you schedule them.`);
  const publishDrafts = () => run(async () => {
    for (const e of publishable) await api('/api/admin/schedule', { method: 'PUT', json: { date: e.date, assetId: e.assetId, status: 'scheduled' } });
  }, `${publishable.length} draft(s) scheduled.`);

  // Next day with nothing published — the thing most worth knowing.
  const nextGap = days.find((d) => d >= today && byDate.get(d)?.status !== 'scheduled');

  const pickerEntry = picking ? byDate.get(picking) : undefined;
  const choices = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets
      .filter((a) => a.status === 'approved' || a.status === 'review')
      .filter((a) => !q || [a.meta.displayName, a.meta.answer, a.meta.category].some((s) => s.toLowerCase().includes(q)))
      .sort((a, b) => a.scheduled.length - b.scheduled.length || a.meta.displayName.localeCompare(b.meta.displayName));
  }, [assets, query]);

  if (!ready) return error
    ? <p role="alert" className="panel p-4 text-sm text-stamp-hi">{error}</p>
    : <p className="label py-20 text-center text-smoke"><span className="pulse-dot">●</span> Opening the diary…</p>;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="typed text-2xl text-paper">Daily schedule</h1>
          <p className="mt-1 max-w-2xl text-sm text-smoke">
            One case per day, changing at midnight {timezone} time. Today is <span className="text-paper">{formatDate(today)}</span>.
            Only days marked <span className="text-banker-hi">scheduled</span> are published; drafts and empty days show players a “no case today” screen.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost" onClick={autoFill} disabled={busy || !unused.length || !emptyDays.length}
            title="Fills empty days with unused approved models, in the order they were added, as drafts">
            Fill empty days ({Math.min(unused.length, emptyDays.length)})
          </button>
          <button type="button" className="btn btn-brass" onClick={publishDrafts} disabled={busy || !publishable.length}>Schedule all drafts ({publishable.length})</button>
        </div>
      </div>

      {error && <p role="alert" className="panel mb-4 border-stamp-hi/60 p-3 text-sm text-stamp-hi">{error}</p>}
      {notice && <p role="status" className="panel mb-4 border-banker-hi/50 p-3 text-sm text-banker-hi">{notice}</p>}
      {nextGap && (
        <p className="panel mb-4 border-[#e39a4c]/50 p-3 text-sm text-[#e39a4c]">
          {nextGap === today ? 'Nothing is published for today.' : `Nothing is published for ${formatDate(nextGap, { weekday: 'long', day: 'numeric', month: 'long' })}.`}
          {' '}{unused.length} approved model{unused.length === 1 ? '' : 's'} not yet on the calendar.
        </p>
      )}

      <div className="hidden grid-cols-7 gap-2 pb-2 md:grid">
        {DAYS.map((d) => <span key={d} className="field-label !mb-0 text-center">{d}</span>)}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-7">
        {days.map((date) => {
          const entry = byDate.get(date);
          const asset = entry && byId.get(entry.assetId);
          const past = date < today;
          const isToday = date === today;
          return (
            <div key={date} className={`panel flex min-h-36 flex-col p-2 ${past ? 'opacity-55' : ''} ${isToday ? '!border-brass-hi' : ''}`}>
              <div className="flex items-center justify-between gap-1">
                <span className={`text-xs ${isToday ? 'text-brass-hi' : 'text-smoke'}`}>
                  <span className="md:hidden">{DAYS[weekday(date)]} </span>{formatDate(date, { day: 'numeric', month: 'short' })}{isToday && ' · today'}
                </span>
                {entry && <span className={`chip ${entry.status}`}>{past ? 'Ran' : entry.status}</span>}
              </div>
              {entry ? (
                <>
                  <div className="mt-2 flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/admin/assets/${entry.assetId}/image?kind=thumb`} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-sm bg-[#d9d2c0] object-cover" />
                    <Link href={`/admin/assets/${entry.assetId}`} className="typed line-clamp-2 text-sm leading-tight text-paper hover:text-brass-hi">
                      {asset?.meta.displayName ?? 'Deleted model'}
                    </Link>
                  </div>
                  {asset && !past && asset.status !== 'approved' && <p className="mt-1 text-[0.68rem] text-[#e39a4c]">Model is not approved</p>}
                  {!past && (
                    <div className="mt-auto flex flex-wrap gap-1 pt-2">
                      <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={() => { setPicking(date); setQuery(''); }} disabled={busy}>Change</button>
                      {entry.status === 'draft'
                        ? <button type="button" className="btn btn-brass btn-sm !px-2" onClick={() => assign(date, entry.assetId, 'scheduled')} disabled={busy}>Schedule</button>
                        : <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={() => assign(date, entry.assetId, 'draft')} disabled={busy}>Unpublish</button>}
                      <Link href={`/admin/preview/${date}`} className="btn btn-ghost btn-sm !px-2" title="Play this day exactly as players will">Test</Link>
                    </div>
                  )}
                </>
              ) : past ? (
                <p className="m-auto text-xs text-smoke/70">No case</p>
              ) : (
                <button type="button" className="m-auto rounded-sm border border-dashed border-smoke/40 px-3 py-2 text-xs text-smoke hover:border-brass-hi hover:text-brass-hi"
                  onClick={() => { setPicking(date); setQuery(''); }} disabled={busy}>+ Assign a case</button>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-smoke">
        <span>Showing to {end && formatDate(end)}.</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setWeeks((w) => w + 4)}>Show 4 more weeks</button>
      </div>

      {picking && (
        <Dialog title={`Case for ${formatDate(picking, { weekday: 'long', day: 'numeric', month: 'long' })}`} onClose={() => setPicking(null)} wide>
          {picking === today && pickerEntry?.status === 'scheduled' && (
            <p className="mb-3 border-l-2 border-stamp pl-3 text-sm text-stamp">Today’s case is live. Changing it now swaps the puzzle for everyone mid-day.</p>
          )}
          <input type="search" className="type-input w-full" placeholder="Search models…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
          <ul className="mt-3 max-h-[50vh] space-y-1 overflow-y-auto pr-1">
            {choices.length === 0 && <li className="muted py-6 text-center text-sm">No approved or in-review models match.</li>}
            {choices.map((a) => {
              const ok = a.status === 'approved' && !a.missing.length && !a.fileMissing;
              const pick = async (status: 'draft' | 'scheduled') => { if (await assign(picking, a.id, status)) setPicking(null); };
              return (
                <li key={a.id} className="flex items-center gap-3 border-b border-typeink/15 py-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/admin/assets/${a.id}/image?kind=thumb`} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-sm bg-[#d9d2c0] object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="typed truncate">{a.meta.displayName || a.file}</p>
                    <p className="muted truncate text-xs">
                      {a.meta.category || 'No category'} · {a.meta.difficulty}
                      {a.scheduled.length ? ` · already on ${a.scheduled.map((d) => formatDate(d, { day: 'numeric', month: 'short' })).join(', ')}` : ' · unused'}
                      {!ok && ` · ${a.status !== 'approved' ? 'not approved' : 'incomplete'} (draft only)`}
                    </p>
                  </div>
                  <button type="button" className="btn btn-line btn-sm" onClick={() => pick('draft')} disabled={busy}>Draft</button>
                  <button type="button" className="btn btn-ink btn-sm" onClick={() => pick('scheduled')} disabled={busy || !ok}>Schedule</button>
                </li>
              );
            })}
          </ul>
          {pickerEntry && (
            <div className="mt-4 flex justify-end">
              <button type="button" className="btn btn-line btn-sm" onClick={async () => { if (await clear(picking)) setPicking(null); }} disabled={busy}>Clear this day</button>
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
}
