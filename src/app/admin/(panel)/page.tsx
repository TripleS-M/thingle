import type { Metadata } from 'next';
import Library from '@/components/admin/Library';

export const metadata: Metadata = { title: 'Model library' };

export default function LibraryPage() {
  return <Library />;
}
