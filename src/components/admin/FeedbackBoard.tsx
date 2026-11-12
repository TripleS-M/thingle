'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, formatDate } from '@/lib/client';

interface Row {
  id: number; date: string; mode: 'daily' | 'practice'; assetId: string; thing: string; rating: number; comment: string;
  outcome: 'won' | 'lost'; guesses: number; hints: string[]; score: number; createdAt: string;
}
interface Summary {
  date: string; assetId: string; thing: string; responses: number; avgRating: number; distribution: number[];
  solved: number; avgGuesses: number; avgScore: number; comments: number;
}
interface Data { rows: Row[]; summary: Summary[]; things: { assetId: string; thing: string }[]; labels: string[] }

/** Colour runs from green (easy) through brass to red (hard). */
const tone = (rating: number) => (rating < 3 ? 'var(--color-banker-hi)' : rating <= 5 ? 'var(--color-brass-hi)' : 'var(--color-stamp-hi)');

export default function FeedbackBoard() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [asset, setAsset] = useState('');
  const [mode, setMode] = useState('');
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [onlyComments, setOnlyComments] = useState(false);

  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    if (asset) q.set('asset', asset);
    if (mode) q.set('mode', mode);
    return q.toString();
  }, [from, to, asset, mode]);

  useEffect(() => {
    let live = true;
    api<Data>(`/api/admin/feedback?${query}`)
      .then((d) => { if (live) { setData(d); setError(''); } })
      .catch((e) => { if (live) setError((e as Error).message); });
    return () => { live = false; };
  }, [query]);

  const labels = data?.labels ?? [];
  const rows = (data?.rows ?? []).filter((r) => !onlyComments || r.comment);
  const total = data?.rows.length ?? 0;
  const overall = total ? Math.round((data!.rows.reduce((s, r) => s + r.rating, 0) / total) * 10) / 10 : 0;
  const filtered = !!(from || to || asset || mode);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="typed text-2xl text-paper">Player feedback</h1>
          <p className="mt-1 max-w-2xl text-sm text-smoke">
            What players said after each case: how hard it felt on a 1–7 scale (1 extremely easy, 7 extremely hard) and any comment.
            Filter by day or by thing, or export everything for a spreadsheet.
          </p>
        </div>
        <a className="btn btn-ghost" href={`/api/admin/feedback?${query}${query ? '&' : ''}format=csv`}>Export CSV</a>
      </div>

      <div className="panel mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[10rem_10rem_1fr_10rem_auto] lg:items-end">
        <label><span className="field-label">From day</span><input type="date" className="field" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
        <label><span className="field-label">To day</span><input type="date" className="field" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
        <label>
          <span className="field-label">Thing</span>
          <select className="field" value={asset} onChange={(e) => setAsset(e.target.value)}>
            <option value="">All things</option>
            {data?.things.map((t) => <option key={t.assetId} value={t.assetId}>{t.thing || t.assetId}</option>)}
          </select>
        </label>
        <label>
          <span className="field-label">Played as</span>
          <select className="field" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="">Daily + practice</option>
            <option value="daily">Daily only</option>
            <option value="practice">Practice only</option>
          </select>
        </label>
        <button type="button" className="btn btn-ghost" disabled={!filtered} onClick={() => { setFrom(''); setTo(''); setAsset(''); setMode(''); }}>Clear</button>
      </div>

      {error && <p role="alert" className="panel mb-5 border-stamp-hi/60 p-3 text-sm text-stamp-hi">{error}</p>}
      {!data && !error && <p className="label py-16 text-center text-smoke"><span className="pulse-dot">●</span> Reading the mail…</p>}

      {data && total === 0 && (
        <div className="panel p-8 text-center">
          <p className="typed text-lg text-paper">{filtered ? 'Nothing matches these filters.' : 'No feedback yet.'}</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-smoke">Players are asked once, after a case ends. Responses appear here as they come in.</p>
        </div>
      )}

      {data && total > 0 && (
        <>
          <p className="mb-3 text-sm text-smoke">
            <span className="text-paper">{total}</span> response{total === 1 ? '' : 's'} · average difficulty{' '}
            <span style={{ color: tone(overall) }}>{overall.toFixed(1)} / 7</span> ({labels[Math.round(overall) - 1]?.toLowerCase()})
          </p>

          <div className="panel mb-6 overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="text-left">
                  {['Day', 'Thing', 'Responses', 'Felt difficulty', 'Spread (1 → 7)', 'Solved', 'Avg guesses', 'Avg score'].map((h) => (
                    <th key={h} className="field-label !mb-0 !table-cell border-b border-brass/25 px-3 py-2.5 text-left font-normal whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.summary.map((s) => {
                  const peak = Math.max(1, ...s.distribution);
                  return (
                    <tr key={`${s.date}|${s.assetId}`} className="border-b border-brass/10 last:border-0">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <button type="button" className="text-paper underline-offset-2 hover:text-brass-hi hover:underline" title="Show only this day"
                          onClick={() => { setFrom(s.date); setTo(s.date); }}>{formatDate(s.date)}</button>
                      </td>
                      <td className="px-3 py-2">
                        <button type="button" className="typed text-left text-paper underline-offset-2 hover:text-brass-hi hover:underline" title="Show only this thing"
                          onClick={() => setAsset(s.assetId)}>{s.thing || s.assetId}</button>
                        <Link href={`/admin/assets/${s.assetId}`} className="ml-2 text-xs text-smoke hover:text-brass-hi">edit</Link>
                      </td>
                      <td className="px-3 py-2 tabular-nums text-paper">{s.responses}{s.comments > 0 && <span className="text-smoke"> · {s.comments} note{s.comments === 1 ? '' : 's'}</span>}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="tabular-nums" style={{ color: tone(s.avgRating) }}>{s.avgRating.toFixed(1)}</span>
                        <span className="ml-2 text-xs text-smoke">{labels[Math.round(s.avgRating) - 1]}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex h-7 items-end gap-0.5" role="img" aria-label={s.distribution.map((n, i) => `${labels[i]}: ${n}`).join(', ')}>
                          {s.distribution.map((n, i) => (
                            <span key={i} title={`${labels[i]}: ${n}`} className="w-3 rounded-t-sm"
                              style={{ height: `${n ? Math.max(12, (n / peak) * 100) : 4}%`, background: n ? tone(i + 1) : 'rgba(154,139,116,0.3)' }} />
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 tabular-nums text-paper">{Math.round((s.solved / s.responses) * 100)}%</td>
                      <td className="px-3 py-2 tabular-nums text-paper">{s.solved ? s.avgGuesses.toFixed(1) : '—'}</td>
                      <td className="px-3 py-2 tabular-nums text-paper">{s.avgScore}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="typed text-lg text-brass-hi">Individual responses</h2>
            <label className="flex items-center gap-2 text-sm text-paper">
              <input type="checkbox" checked={onlyComments} onChange={(e) => setOnlyComments(e.target.checked)} className="h-4 w-4 accent-[var(--color-brass-hi)]" />
              Only with a comment
            </label>
          </div>
          <ul className="space-y-2">
            {rows.length === 0 && <li className="py-6 text-center text-sm text-smoke">No comments in this selection.</li>}
            {rows.slice(0, 300).map((r) => (
              <li key={r.id} className="panel p-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-smoke">
                  <span className="chip" style={{ color: tone(r.rating) }}>{r.rating} · {labels[r.rating - 1]}</span>
                  <span className="typed text-sm text-paper">{r.thing || r.assetId}</span>
                  <span>{formatDate(r.date)}{r.mode === 'practice' && ' · practice'}</span>
                  <span>{r.outcome === 'won' ? `solved in ${r.guesses}` : 'not solved'} · {r.score} pts · {r.hints.length ? `hints: ${r.hints.join(', ')}` : 'no hints'}</span>
                </div>
                {r.comment && <p className="mt-2 text-sm text-paper">“{r.comment}”</p>}
              </li>
            ))}
          </ul>
          {rows.length > 300 && <p className="mt-3 text-center text-sm text-smoke">Showing the newest 300 of {rows.length}. Narrow the filters or export the CSV for the rest.</p>}
        </>
      )}
    </div>
  );
}
