import type { Metadata } from 'next';
import ScheduleBoard from '@/components/admin/ScheduleBoard';

export const metadata: Metadata = { title: 'Schedule' };

export default function SchedulePage() {
  return <ScheduleBoard />;
}
