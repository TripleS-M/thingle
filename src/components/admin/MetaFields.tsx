'use client';

import { useState } from 'react';
import { isCorrect, normaliseAnswer } from '@/lib/answers';
import { CATEGORIES, DIFFICULTIES, type AssetMeta, type Difficulty } from '@/lib/types';

const LICENCES = ['CC0 1.0 (public domain)', 'CC BY 4.0', 'CC BY-SA 4.0', 'Public domain', 'Original work (own model)', 'Royalty-free (purchased licence)'];

function Field({ label, hint, required, missing, children }: {
  label: string; hint?: string; required?: boolean; missing?: boolean; children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="field-label">
        {label}{required && <span className={missing ? 'text-[#e39a4c]' : 'text-smoke/60'}> · required</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs leading-relaxed text-smoke/80">{hint}</span>}
    </label>
  );
}

function licenceWarnings(meta: AssetMeta): string[] {
  const l = meta.licence.toLowerCase();
  const out: string[] = [];
  if (!l) return out;
  if (/\bnc\b|non-?commercial/.test(l)) out.push('Non-commercial licence: only usable if this game is never monetised (no ads, sales or sponsorship).');
  if (/\bnd\b|no-?deriv/.test(l)) out.push('No-derivatives licence: converting or re-rendering the model may count as an adaptation. Check before using it.');
  if (/\bby\b|attribution/.test(l) && !meta.attribution.trim() && !meta.creator.trim()) out.push('This licence requires attribution — fill in the creator and the attribution line. They are shown to players on the results screen.');
  if (/unknown|unclear|\?/.test(l)) out.push('Unclear usage rights: do not publish this model until the licence is confirmed.');
  return out;
}

export default function MetaFields({ meta, onChange }: { meta: AssetMeta; onChange: (patch: Partial<AssetMeta>) => void }) {
  const [probe, setProbe] = useState('');
  const text = (k: keyof AssetMeta) => ({
    value: meta[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange({ [k]: e.target.value } as Partial<AssetMeta>),
  });
  const categories = meta.category && !CATEGORIES.includes(meta.category) ? [meta.category, ...CATEGORIES] : CATEGORIES;
  const warnings = licenceWarnings(meta);
  const verdict = probe.trim() ? isCorrect(probe, meta.answer, meta.accepted) : null;

  return (
    <div className="space-y-5">
      <section className="panel space-y-4 p-4">
        <h2 className="typed text-lg text-brass-hi">The case</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Display name" required missing={!meta.displayName.trim()} hint="Internal name in the records room. Never shown to players before the reveal.">
            <input className="field" {...text('displayName')} />
          </Field>
          <Field label="Correct answer" required missing={!meta.answer.trim()} hint="Shown on the results screen.">
            <input className="field" {...text('answer')} />
          </Field>
        </div>
        <Field label="Accepted alternative answers" hint="One per line. Capitals, punctuation, hyphens, spacing and a leading “a / the” are already ignored — list genuinely different names only (e.g. “camshaft”, “engine camshaft”).">
          <textarea className="field" rows={4} value={meta.accepted.join('\n')}
            onChange={(e) => onChange({ accepted: e.target.value.split('\n') })}
            onBlur={() => onChange({ accepted: [...new Set(meta.accepted.map((a) => a.trim()).filter(Boolean))] })} />
        </Field>
        <div>
          <span className="field-label">Try a guess against these answers</span>
          <div className="flex flex-wrap items-center gap-3">
            <input className="field !w-64 max-w-full" placeholder="type what a player might type" value={probe} onChange={(e) => setProbe(e.target.value)} />
            {verdict !== null && (
              <span className={`chip ${verdict ? 'approved' : 'rejected'}`}>{verdict ? 'Accepted' : 'Rejected'}</span>
            )}
            {probe.trim() && <span className="text-xs text-smoke">read as “{normaliseAnswer(probe)}”</span>}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Category" required missing={!meta.category.trim()}>
            <select className="field" {...text('category')}>
              <option value="">— choose —</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Subcategory">
            <input className="field" placeholder="optional" {...text('subcategory')} />
          </Field>
          <Field label="Difficulty">
            <select className="field capitalize" value={meta.difficulty} onChange={(e) => onChange({ difficulty: e.target.value as Difficulty })}>
              {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Description" hint="A sentence or two shown with the answer after the game ends.">
          <textarea className="field" rows={3} {...text('description')} />
        </Field>
      </section>

      <section className="panel space-y-4 p-4">
        <h2 className="typed text-lg text-brass-hi">Hints</h2>
        <Field label="Hint 1 · category reveal" required missing={!meta.hint1.trim()} hint="Usually just the category, e.g. “Motorsport”.">
          <input className="field" {...text('hint1')} />
        </Field>
        <Field label="Hint 2 · function / context clue" required missing={!meta.hint2.trim()} hint="Helpful without naming it, e.g. “This component manages airflow at the front of a racing car.”">
          <textarea className="field" rows={2} {...text('hint2')} />
        </Field>
        <p className="text-xs text-smoke">Hint 3 is the limited rotation — set its allowance under the preview. Point costs are global and live in Settings.</p>
      </section>

      <section className="panel space-y-4 p-4">
        <h2 className="typed text-lg text-brass-hi">Source &amp; licence</h2>
        <p className="text-xs leading-relaxed text-smoke">
          A model being publicly viewable does not mean it may be used in a game. Record where it came from and the licence it was released under.
          A model cannot be approved without a licence.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Source website"><input className="field" placeholder="e.g. Sketchfab, Poly Haven, own work" {...text('sourceSite')} /></Field>
          <Field label="Source URL"><input className="field" type="url" placeholder="https://…" {...text('sourceUrl')} /></Field>
          <Field label="Creator"><input className="field" {...text('creator')} /></Field>
          <Field label="Licence" required missing={!meta.licence.trim()}>
            <input className="field" list="licences" placeholder="e.g. CC BY 4.0" {...text('licence')} />
            <datalist id="licences">{LICENCES.map((l) => <option key={l} value={l} />)}</datalist>
          </Field>
        </div>
        <Field label="Attribution line" hint="Exact credit text the licence asks for. Shown to players on the results screen.">
          <input className="field" placeholder="“Front Wing” by A. Creator, licensed under CC BY 4.0" {...text('attribution')} />
        </Field>
        {warnings.map((w) => <p key={w} className="border-l-2 border-[#e39a4c] pl-3 text-sm text-[#e39a4c]">{w}</p>)}
      </section>
    </div>
  );
}
