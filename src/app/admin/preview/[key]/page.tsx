import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import Game from '@/components/Game';

export const metadata: Metadata = { title: 'Player preview', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// The complete player experience for one model (key = asset id) or one
// calendar day (key = YYYY-MM-DD, including future days). Admin only; plays
// here never touch daily statistics.
export default async function PreviewPage({ params }: { params: Promise<{ key: string }> }) {
  if (!(await isAdmin())) redirect('/admin/login');
  const { key } = await params;
  const isDate = /^\d{4}-\d{2}-\d{2}$/.test(key);
  return (
    <>
      <div className="border-b border-brass/25 bg-walnut-950/80">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <span className="label text-lamp">Records room · player preview{isDate ? ` · ${key}` : ''}</span>
          <Link href={isDate ? '/admin/schedule' : `/admin/assets/${key}`} className="btn btn-ghost btn-sm">
            ← Back to {isDate ? 'the calendar' : 'the model'}
          </Link>
        </div>
      </div>
      <Game mode="preview" gameKey={key} />
    </>
  );
}
