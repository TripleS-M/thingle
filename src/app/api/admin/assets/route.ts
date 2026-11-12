import crypto from 'node:crypto';
import fs from 'node:fs';
import type { NextRequest } from 'next/server';
import { handler } from '@/lib/auth';
import { listAssets } from '@/lib/assets';
import { db } from '@/lib/db';
import { saveUpload, scanLibrary } from '@/lib/ingest';

export const dynamic = 'force-dynamic';
const MAX_UPLOAD = 150 * 1024 * 1024;

export const GET = handler(async () => ({ assets: listAssets() }), { admin: true });

// POST multipart { file, category } -> saves into the library folder and ingests it.
export const POST = handler(async (req: NextRequest) => {
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw new Error('No file uploaded');
  if (file.size > MAX_UPLOAD) throw new Error('File is larger than 150 MB');
  const data = Buffer.from(await file.arrayBuffer());
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  const dup = db().prepare('SELECT file FROM assets WHERE hash = ?').get(hash) as { file: string } | undefined;
  if (dup) throw new Error(`Duplicate: this exact file is already in the library as "${dup.file}"`);
  const saved = saveUpload(file.name, String(form.get('category') ?? ''), data);
  const report = await scanLibrary();
  const failed = report.errors.find((e) => saved.split('\\').join('/').endsWith(e.file));
  if (failed) { fs.rmSync(saved, { force: true }); throw new Error(`Model could not be loaded: ${failed.error}`); }
  return { report, assets: listAssets() };
}, { admin: true });
