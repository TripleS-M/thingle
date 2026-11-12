import type { Metadata } from 'next';
import Archive from '@/components/Archive';

export const metadata: Metadata = { title: 'Case archive' };

export default function ArchivePage() {
  return <Archive />;
}
