'use client';

import Dialog from '../Dialog';
import type { Scoring } from '@/lib/types';

export default function HowTo({ scoring, onClose }: { scoring: Scoring | null; onClose: () => void }) {
  const points = scoring?.guessPoints ?? [500, 400, 300, 200, 100];
  const costs = scoring?.hintCosts ?? { category: 50, function: 100, rotation: 100 };
  return (
    <Dialog title="How the case works" onClose={onClose}>
      <div className="space-y-4 text-[0.95rem]">
        <p>
          Every day one object lands on the desk — photographed only as a <strong>black silhouette</strong>.
          Work out what it is in <strong>{points.length} guesses</strong>.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Type what you think the object is. Common names and abbreviations count, and small spelling mistakes are forgiven.</li>
          <li>A wrong guess tells you nothing more — the shadow never changes. Look again.</li>
          <li>Hints never use up a guess, but each one costs points, and each can be opened once.</li>
          <li>Solve it (or run out of guesses) and the object is revealed in full colour.</li>
        </ul>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="label muted mb-1.5">Points for solving</p>
            <table className="w-full text-sm">
              <tbody>
                {points.map((p, i) => (
                  <tr key={i} className="rule">
                    <td className="py-1">Guess {i + 1}</td>
                    <td className="py-1 text-right font-bold">{p}</td>
                  </tr>
                ))}
                <tr><td className="py-1">Unsolved</td><td className="py-1 text-right font-bold">0</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <p className="label muted mb-1.5">Hints</p>
            <table className="w-full text-sm">
              <tbody>
                <tr className="rule"><td className="py-1">A · Category</td><td className="py-1 text-right font-bold">−{costs.category}</td></tr>
                <tr className="rule"><td className="py-1">B · What it does</td><td className="py-1 text-right font-bold">−{costs.function}</td></tr>
                <tr><td className="py-1">C · Turn the photo</td><td className="py-1 text-right font-bold">−{costs.rotation}</td></tr>
              </tbody>
            </table>
            <p className="muted mt-2 text-xs">The rotation hint lets you drag the silhouette a little way round. It stays black.</p>
          </div>
        </div>
        <p className="muted text-sm">A new case is filed every midnight. Your record is tied to this browser — no account needed.</p>
        <button type="button" className="btn btn-ink w-full" onClick={onClose}>Open the case</button>
      </div>
    </Dialog>
  );
}
