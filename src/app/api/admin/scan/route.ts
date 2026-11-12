import { handler } from '@/lib/auth';
import { listAssets } from '@/lib/assets';
import { scanLibrary } from '@/lib/ingest';

// POST -> scan the asset folder for new, moved or missing models
export const POST = handler(async () => ({ report: await scanLibrary(), assets: listAssets() }), { admin: true });
