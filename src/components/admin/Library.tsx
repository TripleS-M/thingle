'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api, formatDate } from '@/lib/client';
import { CATEGORIES, type Asset, type AssetStatus } from '@/lib/types';

interface ScanReport {
  added: { id: string; file: string }[];
  duplicates: { file: string; duplicateOf: string }[];
  errors: { file: string; error: string }[];
  moved: number;
  missing: number;
  total: number;
}

type Filter = 'all' | AssetStatus | 'incomplete';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'review', label: 'In review' },
  { key: 'incomplete', label: 'Needs configuration' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'archived', label: 'Archived' },
];
export const STATUS_LABEL: Record<AssetStatus, string> = { review: 'In review', approved: 'Approved', rejected: 'Rejected', archived: 'Archived' };

function ReportCard({ report, uploaded, onClose }: { report: ScanReport; uploaded: boolean; onClose: () => void }) {
  const quiet = !report.added.length && !report.duplicates.length && !report.errors.length && !report.moved && !report.missing;
  return (
    <div className="panel fade mb-5 p-4 text-sm" role="status">
      <div className="flex items-start justify-between gap-4">
        <p className="typed text-brass-hi">{uploaded ? 'Upload complete' : 'Folder scan complete'} · {report.total} model{report.total === 1 ? '' : 's'} registered</p>
        <button type="button" className="label text-smoke hover:text-paper" onClick={onClose}>Dismiss</button>
      </div>
      {quiet && <p className="mt-2 text-smoke">Nothing new. Drop model files into <code>assets/shadowplay/&lt;category&gt;/</code> and scan again.</p>}
      {report.added.length > 0 && (
        <div className="mt-3">
          <p className="text-paper">{report.added.length} new model{report.added.length === 1 ? '' : 's'} registered <span className="text-lamp">in review — nothing is published until you approve and schedule it.</span></p>
          <ul className="mt-1 space-y-0.5">
            {report.added.map((a) => (
              <li key={a.id}><Link className="text-brass-hi underline underline-offset-2" href={`/admin/assets/${a.id}`}>{a.file}</Link></li>
            ))}
          </ul>
        </div>
      )}
      {report.duplicates.length > 0 && (
        <div className="mt-3">
          <p className="text-[#e39a4c]">{report.duplicates.length} duplicate{report.duplicates.length === 1 ? '' : 's'} skipped (identical file contents):</p>
          <ul className="mt-1 space-y-0.5 text-smoke">
            {report.duplicates.map((d) => <li key={d.file}>{d.file} <span className="opacity-70">= {d.duplicateOf}</span></li>)}
          </ul>
        </div>
      )}
      {report.errors.length > 0 && (
        <div className="mt-3">
          <p className="text-stamp-hi">{report.errors.length} file{report.errors.length === 1 ? '' : 's'} could not be read:</p>
          <ul className="mt-1 space-y-0.5 text-smoke">
            {report.errors.map((e) => <li key={e.file}>{e.file} — {e.error}</li>)}
          </ul>
        </div>
      )}
      {report.moved > 0 && <p className="mt-3 text-smoke">{report.moved} moved or renamed file{report.moved === 1 ? '' : 's'} re-linked.</p>}
      {report.missing > 0 && <p className="mt-3 text-[#e39a4c]">{report.missing} registered model{report.missing === 1 ? ' is' : 's are'} missing from the folder.</p>}
    </div>
  );
}

function Card({ asset, today }: { asset: Asset; today: string }) {
  const m = asset.meta;
  const upcoming = asset.scheduled.filter((d) => d > today);
  const used = asset.scheduled.filter((d) => d <= today);
  return (
    <Link href={`/admin/assets/${asset.id}`} className="panel group flex flex-col overflow-hidden transition hover:border-brass-hi/70">
      <div className="relative aspect-square bg-[#d9d2c0]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/admin/assets/${asset.id}/image?kind=thumb`} alt="" loading="lazy" className="h-full w-full object-cover" />
        <span className={`chip ${asset.status} absolute top-2 left-2 bg-walnut-950/85`}>{STATUS_LABEL[asset.status]}</span>
        {asset.fileMissing && <span className="chip rejected absolute right-2 bottom-2 bg-walnut-950/85">File missing</span>}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="typed truncate text-paper group-hover:text-brass-hi">{m.displayName || asset.file}</p>
        <p className="truncate text-xs text-smoke">{m.category || 'No category'} · <span className="capitalize">{m.difficulty}</span> · .{asset.format}</p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-1.5">
          {asset.missing.length > 0 && <span className="chip warn" title={`Missing: ${asset.missing.join(', ')}`}>Requires configuration</span>}
          {upcoming.length > 0 && <span className="chip scheduled" title={upcoming.join(', ')}>Scheduled {formatDate(upcoming[0], { day: 'numeric', month: 'short' })}</span>}
          {used.length > 0
            ? <span className="chip draft" title={used.join(', ')}>Used {formatDate(used[used.length - 1], { day: 'numeric', month: 'short' })}</span>
            : upcoming.length === 0 && <span className="chip draft">Unused</span>}
        </div>
        <p className="text-[0.68rem] text-smoke/70">Added {formatDate(asset.dateAdded.slice(0, 10))}</p>
      </div>
    </Link>
  );
}

export default function Library() {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [today, setToday] = useState('');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<'' | 'scan' | 'upload'>('');
  const [report, setReport] = useState<{ report: ScanReport; uploaded: boolean } | null>(null);
  const [uploadCategory, setUploadCategory] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [a, s] = await Promise.all([
        api<{ assets: Asset[] }>('/api/admin/assets'),
        api<{ today: string }>('/api/admin/settings'),
      ]);
      setAssets(a.assets);
      setToday(s.today);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const scan = async () => {
    setBusy('scan'); setError('');
    try {
      const r = await api<{ report: ScanReport; assets: Asset[] }>('/api/admin/scan', { method: 'POST' });
      setAssets(r.assets);
      setReport({ report: r.report, uploaded: false });
    } catch (e) { setError((e as Error).message); }
    setBusy('');
  };

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileInput.current?.files?.[0];
    if (!file) return;
    setBusy('upload'); setError('');
    try {
      const body = new FormData();
      body.set('file', file);
      body.set('category', uploadCategory);
      const r = await api<{ report: ScanReport; assets: Asset[] }>('/api/admin/assets', { method: 'POST', body });
      setAssets(r.assets);
      setReport({ report: r.report, uploaded: true });
      setShowUpload(false);
      if (fileInput.current) fileInput.current.value = '';
    } catch (e) { setError((e as Error).message); }
    setBusy('');
  };

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, review: 0, approved: 0, rejected: 0, archived: 0, incomplete: 0 };
    for (const a of assets ?? []) { c.all++; c[a.status]++; if (a.missing.length) c.incomplete++; }
    return c;
  }, [assets]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (assets ?? []).filter((a) => {
      if (filter === 'incomplete' ? !a.missing.length : filter !== 'all' && a.status !== filter) return false;
      if (category && a.meta.category !== category) return false;
      if (!q) return true;
      return [a.meta.displayName, a.meta.answer, a.file, a.meta.category, a.meta.subcategory, a.meta.creator].some((s) => s.toLowerCase().includes(q));
    });
  }, [assets, filter, category, query]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="typed text-2xl text-paper">Model library</h1>
          <p className="mt-1 max-w-2xl text-sm text-smoke">
            Every model found in <code className="text-paper/90">assets/shadowplay/</code>. New files arrive <span className="text-lamp">in review</span> and
            are never published until you approve and schedule them.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost" onClick={scan} disabled={!!busy}>{busy === 'scan' ? 'Scanning…' : 'Scan asset folder'}</button>
          <button type="button" className="btn btn-brass" onClick={() => setShowUpload((v) => !v)} aria-expanded={showUpload}>Upload model</button>
        </div>
      </div>

      {showUpload && (
        <form onSubmit={upload} className="panel fade mb-5 grid gap-4 p-4 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
          <div>
            <label className="field-label" htmlFor="upload-file">Model file (.glb, .gltf, .obj, .stl)</label>
            <input id="upload-file" ref={fileInput} type="file" accept=".glb,.gltf,.obj,.stl" required className="field file:mr-3 file:border-0 file:bg-transparent file:text-brass-hi" />
          </div>
          <div>
            <label className="field-label" htmlFor="upload-category">Category folder</label>
            <select id="upload-category" className="field" value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}>
              <option value="">random (uncategorised)</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn-brass" disabled={!!busy}>{busy === 'upload' ? 'Processing…' : 'Upload & ingest'}</button>
          <p className="text-xs text-smoke sm:col-span-3">
            Only upload models whose licence permits use in a game. You will record the source, creator and licence on the next screen — a model
            cannot be approved without a licence.
          </p>
        </form>
      )}

      {error && <p role="alert" className="panel mb-5 border-stamp-hi/60 p-3 text-sm text-stamp-hi">{error}</p>}
      {report && <ReportCard report={report.report} uploaded={report.uploaded} onClose={() => setReport(null)} />}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)} aria-pressed={filter === f.key}
            className={`btn btn-sm ${filter === f.key ? 'btn-brass' : 'btn-ghost'}`}>
            {f.label} <span className="opacity-70">{counts[f.key]}</span>
          </button>
        ))}
        <div className="ml-auto flex flex-wrap gap-2">
          <select aria-label="Filter by category" className="field !w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input aria-label="Search models" type="search" placeholder="Search…" className="field !w-44" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {assets === null && !error && <p className="label py-16 text-center text-smoke"><span className="pulse-dot">●</span> Opening the cabinet…</p>}
      {assets !== null && assets.length === 0 && (
        <div className="panel p-8 text-center">
          <p className="typed text-lg text-paper">The cabinet is empty.</p>
          <p className="mx-auto mt-2 max-w-lg text-sm text-smoke">
            Copy .glb / .gltf / .obj / .stl files into <code className="text-paper/90">assets/shadowplay/&lt;category&gt;/</code> and press
            “Scan asset folder”, or use “Upload model”. Run <code className="text-paper/90">npm run seed</code> for the sample set.
          </p>
        </div>
      )}
      {assets !== null && assets.length > 0 && shown.length === 0 && <p className="py-12 text-center text-sm text-smoke">No models match these filters.</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {shown.map((a) => <Card key={a.id} asset={a} today={today} />)}
      </div>
    </div>
  );
}
