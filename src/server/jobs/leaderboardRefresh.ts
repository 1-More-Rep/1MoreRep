import 'server-only';
import { prisma } from '@/server/db/prisma';
import { buildBoard, type BoardKey } from '@/server/queries/gamification';
import { weekKey } from '@/domain/gamification/xp';

const TOP_K = 100;
const BOARDS: BoardKey[] = ['WEEKLY_XP', 'ALLTIME_XP', 'STREAK', 'VOLUME', 'PR'];

/** Materialize top-K snapshots for every board (opted-out users already excluded by buildBoard). */
export async function refreshLeaderboards(now: Date = new Date()): Promise<{ boards: number; rows: number }> {
  const wk = weekKey(now, 'UTC');
  let rows = 0;
  for (const board of BOARDS) {
    const top = (await buildBoard(board, now)).slice(0, TOP_K);
    const snapWeek = board === 'WEEKLY_XP' ? wk : 'ALL';
    await prisma.$transaction([
      prisma.leaderboardSnapshot.deleteMany({ where: { board, weekKey: snapWeek } }),
      ...top.map((p, i) => prisma.leaderboardSnapshot.create({ data: { board, weekKey: snapWeek, rank: i + 1, userId: p.userId, value: p.value } })),
    ]);
    rows += top.length;
  }
  return { boards: BOARDS.length, rows };
}
