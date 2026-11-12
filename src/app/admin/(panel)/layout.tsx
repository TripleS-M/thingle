import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import AdminNav from '@/components/admin/AdminNav';

export const metadata: Metadata = { title: { default: 'Records room', template: '%s · Records room' }, robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// Every page in this group is behind the admin session. (The API routes check
// the session independently, so this guard is not the only line of defence.)
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect('/admin/login');
  return (
    <div className="flex min-h-dvh flex-col">
      <AdminNav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
