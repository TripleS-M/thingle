import { handler, playerId } from '@/lib/auth';
import { archive, playerStats } from '@/lib/game';

export const dynamic = 'force-dynamic';

// GET /api/stats -> the anonymous player's statistics and the practice archive
export const GET = handler(async () => {
  const pid = await playerId();
  return { stats: playerStats(pid), archive: archive(pid) };
});
