import type { Metadata } from 'next';
import Game from '@/components/Game';

export const metadata: Metadata = { title: 'Practice case' };

export default async function Practice({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  return <Game mode="practice" gameKey={date} />;
}
