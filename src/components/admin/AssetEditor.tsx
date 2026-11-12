'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Dialog from '@/components/Dialog';
import { api, formatDate } from '@/lib/client';
import type { Asset, AssetMeta, AssetStatus } from '@/lib/types';
import AngleStudio, { REVEALING } from './AngleStudio';
import MetaFields from './MetaFields';
import { STATUS_LABEL } from './Library';

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function AssetEditor({ id }: { id: string }) {
  const router = useRouter();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [meta, setMeta] = useState<AssetMeta | null>(null);
  const [today, setToday] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loadError, setLoadError] = useState('');
  const [exposure, setExposure] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<null | 'delete' | 'revealing'>(null);
  const [keepFile, setKeepFile] = useState(false);
  const [date, setDate] = useState('');

  useEffect(() => {
    let live = true;
    Promise.all([api<{ asset: Asset }>(`/api/admin/assets/${id}`), api<{ today: string }>('/api/admin/settings')])
      .then(([a, s]) => { if (live) { setAsset(a.asset); setMeta(a.asset.meta); setToday(s.today); } })
      .catch((e) => { if (live) setLoadError((e as Error).message); });
    return () => { live = false; };
  }, [id]);

  // Don't lose unsaved edits to a stray tab close.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const change = useCallback((patch: Partial<AssetMeta>) => {
    setMeta((m) => (m ? { ...m, ...patch } : m));
    setDirty(true);
    setNotice('');
  }, []);

  const patch = async (body: { meta?: AssetMeta; status?: AssetStatus }, done: string): Promise<boolean> => {
    setBusy(true); setError(''); setNotice('');
    try {
      const r = await api<{ asset: Asset }>(`/api/admin/assets/${id}`, { method: 'PATCH', json: body });
      setAsset(r.asset); setMeta(r.asset.meta); setDirty(false); setNotice(done);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally { setBusy(false); }
  };

  const save = () => patch({ meta: meta! }, 'Saved.');
  const setStatus = (status: AssetStatus, done: string) => patch({ meta: meta!, status }, done);
  const approve = (force = false) => {
    if (!force && exposure != null && exposure >= REVEALING) { setConfirm('revealing'); return; }
    setConfirm(null);
    void setStatus('approved', 'Approved. It can now be scheduled — it is still not published until it has a date.');
  };

  const remove = async () => {
    setBusy(true); setError('');
    try {
      await api(`/api/admin/assets/${id}${keepFile ? '?keepFile=1' : ''}`, { method: 'DELETE' });
      setDirty(false);
      router.replace('/admin');
    } catch (e) { setError((e as Error).message); setConfirm(null); setBusy(false); }
  };

  const schedule = async (status: 'draft' | 'scheduled') => {
    if (!date) return;
    if (dirty && !(await save())) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api('/api/admin/schedule', { method: 'PUT', json: { date, assetId: id, status } });
      const r = await api<{ asset: Asset }>(`/api/admin/assets/${id}`);
      setAsset(r.asset);
      setNotice(status === 'scheduled' ? `Scheduled for ${formatDate(date)}.` : `Pencilled in as a draft for ${formatDate(date)}.`);
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };

  if (loadError) {
    return (
      <div className="panel mx-auto max-w-lg p-8 text-center">
        <p className="typed text-lg text-paper">This file could not be opened.</p>
        <p className="mt-2 text-sm text-smoke">{loadError}</p>
        <Link href="/admin" className="btn btn-ghost mt-5">Back to the library</Link>
      </div>
    );
  }
  if (!asset || !meta) return <p className="label py-20 text-center text-smoke"><span className="pulse-dot">●</span> Pulling the file…</p>;

  const upcoming = asset.scheduled.filter((d) => d > today);
  const used = asset.scheduled.filter((d) => d <= today);
  const live = asset.scheduled.includes(today);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/admin" className="label text-smoke hover:text-brass-hi">← Model library</Link>
          <h1 className="typed mt-1 truncate text-2xl text-paper">{meta.displayName || asset.file}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`chip ${asset.status}`}>{STATUS_LABEL[asset.status]}</span>
            {asset.missing.length > 0 && <span className="chip warn">Requires configuration</span>}
            {asset.fileMissing && <span className="chip rejected">File missing</span>}
            {live && <span className="chip scheduled">Today’s case</span>}
            {dirty && <span className="chip review">Unsaved changes</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {dirty
            ? <button type="button" className="btn btn-ghost" disabled title="Save your changes first — the preview uses the saved configuration">Preview as player</button>
            : <Link href={`/admin/preview/${asset.id}`} className="btn btn-ghost">Preview as player</Link>}
          <button type="button" className="btn btn-brass" onClick={save} disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save draft'}</button>
        </div>
      </div>

      {error && <p role="alert" className="panel mb-4 border-stamp-hi/60 p-3 text-sm text-stamp-hi">{error}</p>}
      {notice && <p role="status" className="panel mb-4 border-banker-hi/50 p-3 text-sm text-banker-hi">{notice}</p>}
      {asset.missing.length > 0 && (
        <p className="panel mb-4 border-[#e39a4c]/50 p-3 text-sm text-[#e39a4c]">
          Requires configuration before it can be approved — still needs: {asset.missing.join(', ')}.
        </p>
      )}
      {asset.fileMissing && (
        <p className="panel mb-4 border-stamp-hi/60 p-3 text-sm text-stamp-hi">
          The model file <code>{asset.file}</code> is no longer in the asset folder. Put it back and run “Scan asset folder”.
        </p>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="space-y-5 lg:sticky lg:top-4">
          {asset.fileMissing
            ? <div className="panel p-8 text-center text-sm text-smoke">No preview — the model file is missing.</div>
            : <AngleStudio assetId={asset.id} src={`/api/model/${asset.id}`} meta={meta} onChange={change} onExposure={setExposure} />}
        </div>

        <div className="space-y-5">
          <MetaFields meta={meta} onChange={change} />

          <section className="panel space-y-3 p-4">
            <h2 className="typed text-lg text-brass-hi">Review</h2>
            <p className="text-sm text-smoke">
              Only approved models can be scheduled, and only scheduled models are ever shown to players. Approving does not publish anything by itself.
            </p>
            <div className="flex flex-wrap gap-2">
              {asset.status !== 'approved' && <button type="button" className="btn btn-green" onClick={() => approve()} disabled={busy}>Save &amp; approve</button>}
              {asset.status !== 'review' && <button type="button" className="btn btn-ghost" onClick={() => setStatus('review', 'Moved back to review.')} disabled={busy}>Back to review</button>}
              {asset.status !== 'rejected' && <button type="button" className="btn btn-ghost" onClick={() => setStatus('rejected', 'Rejected. Any upcoming dates were pulled back to draft.')} disabled={busy}>Reject</button>}
              {asset.status !== 'archived' && <button type="button" className="btn btn-ghost" onClick={() => setStatus('archived', 'Archived. Any upcoming dates were pulled back to draft.')} disabled={busy}>Archive</button>}
              <button type="button" className="btn btn-danger ml-auto" onClick={() => setConfirm('delete')} disabled={busy}>Delete…</button>
            </div>
          </section>

          <section className="panel space-y-3 p-4">
            <h2 className="typed text-lg text-brass-hi">Schedule</h2>
            {used.length > 0 && <p className="text-sm text-smoke">Already ran: {used.map((d) => formatDate(d)).join(', ')}</p>}
            {upcoming.length > 0 && <p className="text-sm text-paper">Upcoming: {upcoming.map((d) => formatDate(d)).join(', ')}</p>}
            {asset.scheduled.length === 0 && <p className="text-sm text-smoke">Not on the calendar yet.</p>}
            <div className="flex flex-wrap items-end gap-2">
              <label>
                <span className="field-label">Date</span>
                <input type="date" className="field !w-44" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <button type="button" className="btn btn-ghost" onClick={() => schedule('draft')} disabled={busy || !date}>Save as draft</button>
              <button type="button" className="btn btn-brass" onClick={() => schedule('scheduled')} disabled={busy || !date || asset.status !== 'approved'}
                title={asset.status !== 'approved' ? 'Approve the model first' : undefined}>Schedule</button>
              <Link href="/admin/schedule" className="btn btn-ghost">Open calendar</Link>
            </div>
            <p className="text-xs text-smoke">A draft holds the date but is not published. Assigning a date that is already taken replaces what was there.</p>
          </section>

          <section className="panel p-4 text-xs leading-relaxed text-smoke">
            <h2 className="typed mb-2 text-lg text-brass-hi">File</h2>
            <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1">
              <dt>Asset ID</dt><dd className="text-paper">{asset.id}</dd>
              <dt>File</dt><dd className="break-all text-paper">assets/shadowplay/{asset.file}</dd>
              <dt>Format</dt><dd className="text-paper">.{asset.format} · {kb(asset.stats.bytes)}</dd>
              <dt>Geometry</dt><dd className="text-paper">{asset.stats.triangles.toLocaleString()} triangles · {asset.stats.vertices.toLocaleString()} vertices</dd>
              <dt>Dimensions</dt><dd className="text-paper">{asset.stats.size.map((n) => Number(n.toPrecision(3))).join(' × ')} (model units)</dd>
              <dt>Date added</dt><dd className="text-paper">{formatDate(asset.dateAdded.slice(0, 10))}</dd>
              <dt>Last used</dt><dd className="text-paper">{asset.dateLastUsed ? formatDate(asset.dateLastUsed.slice(0, 10)) : 'Never'}</dd>
            </dl>
          </section>
        </div>
      </div>

      {confirm === 'revealing' && (
        <Dialog title="This angle may give it away" onClose={() => setConfirm(null)}>
          <p>
            The starting angle shows {Math.round((exposure ?? 0) * 100)}% of this object’s broadest profile. Silhouettes this open are often
            recognisable at a glance.
          </p>
          <p className="muted mt-2 text-sm">Pick a more oblique starting angle in the preview, or approve it anyway if the object is obscure enough.</p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" className="btn btn-ink" onClick={() => setConfirm(null)}>Choose another angle</button>
            <button type="button" className="btn btn-line" onClick={() => approve(true)}>Approve anyway</button>
          </div>
        </Dialog>
      )}
      {confirm === 'delete' && (
        <Dialog title="Delete this model?" onClose={() => setConfirm(null)}>
          <p>This removes “{meta.displayName || asset.file}” from the library along with its thumbnails and any upcoming dates. It cannot be undone.</p>
          <p className="muted mt-2 text-sm">Models that have already run as a daily case cannot be deleted — archive those instead.</p>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={keepFile} onChange={(e) => setKeepFile(e.target.checked)} className="h-4 w-4" />
            Keep the model file on disk (it will be re-detected on the next scan)
          </label>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" className="btn btn-line" onClick={() => setConfirm(null)}>Cancel</button>
            <button type="button" className="btn btn-danger" onClick={remove} disabled={busy}>Delete model</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
