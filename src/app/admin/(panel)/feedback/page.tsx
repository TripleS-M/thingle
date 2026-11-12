import type { Metadata } from 'next';
import FeedbackBoard from '@/components/admin/FeedbackBoard';

export const metadata: Metadata = { title: 'Player feedback' };

export default function FeedbackPage() {
  return <FeedbackBoard />;
}
