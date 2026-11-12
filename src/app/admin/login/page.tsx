import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { adminPassword, isAdmin, usingDevPassword } from '@/lib/auth';
import LoginForm from '@/components/admin/LoginForm';

export const metadata: Metadata = { title: 'Records room', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await isAdmin()) redirect('/admin');
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="flex w-full flex-col items-center gap-6">
        <Link href="/" className="wordmark text-3xl" aria-label="Thingle — back to the game">Thingle</Link>
        <LoginForm devPassword={usingDevPassword()} configured={adminPassword() !== null} />
        <Link href="/" className="label text-smoke hover:text-brass-hi">← Back to today&rsquo;s case</Link>
      </div>
    </main>
  );
}
