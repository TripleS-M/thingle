'use client';

import { useEffect, useState } from 'react';
import Dialog from '../Dialog';
import { api } from '@/lib/client';
import type { HintType, PlayerStats } from '@/lib/types';

const HINT_NAMES: Record<HintType, string> = { category: 'Category', function: 'Function', rotation: 'Rotation' };

function Figure({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rule pb-2 text-center">
      <div className="typed text-3xl leading-none">{value}</div>
      <div className="label muted mt-1.5 !text-[0.6rem]">{label}</div>
    </div>
  );
}

export default function StatsDialog({ onClose }: { onClose: () => void }) {
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api<{ stats: PlayerStats }>('/api/stats').then((r) => setStats(r.stats)).catch((e: Error) => setError(e.message));
  }, []);

  const peak = stats ? Math.max(1, ...stats.distribution) : 1;
  return (
    <Dialog title="Detective's record" onClose={onClose}>
      {error && <p className="text-stamp">{error}</p>}
      {!stats && !error && <p className="label muted"><span className="pulse-dot">●</span> Pulling your file…</p>}
      {stats && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-x-4 gap-y-4">
            <Figure value={stats.played} label="Cases played" />
            <Figure value={stats.won} label="Cases solved" />
            <Figure value={`${stats.winPct}%`} label="Solve rate" />
            <Figure value={stats.currentStreak} label="Current streak" />
            <Figure value={stats.maxStreak} label="Longest streak" />
            <Figure value={stats.won ? stats.avgGuesses.toFixed(1) : '—'} label="Avg guesses" />
            <Figure value={stats.played ? stats.avgScore : '—'} label="Avg score" />
            <Figure value={stats.totalHints} label="Hints used" />
            <Figure value={stats.mostUsedHint ? HINT_NAMES[stats.mostUsedHint] : '—'} label="Favourite hint" />
          </div>

          <div>
            <p className="label muted mb-2">Solved on guess</p>
            <div className="space-y-1.5">
              {stats.distribution.map((n, i) => {
                const lost = i === stats.distribution.length - 1;
                return (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="typed w-4 text-center">{lost ? '✗' : i + 1}</span>
                    <div className="h-5 flex-1 bg-typeink/10">
                      <div
                        className={`flex h-full min-w-6 items-center justify-end px-1.5 text-xs font-bold text-paper ${lost ? 'bg-stamp' : 'bg-typeink'}`}
                        style={{ width: `${Math.max(6, (n / peak) * 100)}%`, opacity: n ? 1 : 0.35 }}
                      >
                        {n}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="muted text-xs">Only daily cases count here. Practice runs from the archive never touch your record.</p>
        </div>
      )}
    </Dialog>
  );
}
