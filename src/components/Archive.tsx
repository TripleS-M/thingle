'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Shell from './Shell';
import StatsDialog from './game/StatsDialog';
import { api, caseNo, formatDate } from '@/lib/client';
import type { PlayStatus } from '@/lib/types';

interface Entry { date: string; number: number; difficulty: string; daily: PlayStatus | null; practice: PlayStatus | null; score: number | null }

function verdict(e: Entry): { text: string; tone: string } {
  if (e.daily === 'won') return { text: 'Solved on the day', tone: 'text-[#1f6b43]' };
  if (e.daily === 'lost') return { text: 'Went cold', tone: 'text-stamp' };
  if (e.practice === 'won') return { text: 'Solved in practice', tone: 'text-[#1f6b43]' };
  if (e.practice === 'lost') return { text: 'Unsolved in practice', tone: 'text-stamp' };
  if (e.daily === 'playing' || e.practice === 'playing') return { text: 'Left open', tone: 'text-faded' };
  return { text: 'Unopened', tone: 'text-faded' };
}

export default function Archive() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(false);

  useEffect(() => {
    api<{ archive: Entry[] }>('/api/stats').then((r) => setEntries(r.archive)).catch((e: Error) => setError(e.message));
  }, []);

  return (
    <Shell actions={<button type="button" className="btn btn-ghost btn-sm" onClick={() => setStats(true)}>Record</button>}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-black tracking-wide text-paper">Case archive</h1>
            <p className="mt-1 text-sm text-smoke">Reopen any past case for practice. Practice runs never change your record or streak.</p>
          </div>
          <Link href="/" className="btn btn-brass btn-sm">Today&rsquo;s case</Link>
        </div>

        {error && <div className="paper p-5"><p className="text-stamp">{error}</p></div>}
        {!entries && !error && <p className="label text-smoke"><span className="pulse-dot">●</span> Opening the filing cabinet…</p>}
        {entries && entries.length === 0 && (
          <div className="paper p-8 text-center">
            <p className="typed text-xl">The cabinet is empty.</p>
            <p className="muted mt-2">Past cases appear here the day after they run. Come back tomorrow.</p>
          </div>
        )}

        {entries && entries.length > 0 && (
          <ul className="space-y-2.5">
            {entries.map((e) => {
              const v = verdict(e);
              return (
                <li key={e.date}>
                  <Link
                    href={`/practice/${e.date}`}
                    className="paper flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3 transition-transform hover:-translate-y-0.5 sm:px-5"
                  >
                    <span className="typed text-xl">No. {caseNo(e.number)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm">{formatDate(e.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <span className="label muted !text-[0.62rem]">Difficulty · {e.difficulty}</span>
                    </span>
                    <span className={`typed text-sm ${v.tone}`}>
                      {v.text}{e.score !== null && ` · ${e.score}`}
                    </span>
                    <span className="label !text-[0.62rem]" aria-hidden="true">Open →</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {stats && <StatsDialog onClose={() => setStats(false)} />}
    </Shell>
  );
}
