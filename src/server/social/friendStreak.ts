import 'server-only';
import { prisma } from '@/server/db/prisma';
import { daysBetween } from '@/domain/gamification/xp';
import { friendIds } from './friends';
import { writeActivity } from './activity';

const FRIEND_WINDOW_MS = 36 * 3600_000; // forgive timezone spread between friends
const MILESTONES = new Set([7, 30, 100]);

/**
 * After a user completes a workout on `dayKey`, advance friend streaks for any
 * friend who also trained within the window. Stored once per ordered pair.
 */
export async function evaluateFriendStreaks(userId: string, dayKey: string, now: Date = new Date()): Promise<void> {
  const friends = await friendIds(userId);
  if (friends.length === 0) return;
  const since = new Date(now.getTime() - FRIEND_WINDOW_MS);

  for (const fid of friends) {
    const friendTrained = await prisma.workoutSession.findFirst({
      where: { ownerId: fid, status: 'COMPLETED', completedAt: { gte: since } },
      select: { id: true },
    });
    if (!friendTrained) continue;

    const [a, b] = userId < fid ? [userId, fid] : [fid, userId];
    const pair = await prisma.friendStreak.findUnique({ where: { userAId_userBId: { userAId: a, userBId: b } } });
    if (!pair) {
      await prisma.friendStreak.create({ data: { userAId: a, userBId: b, count: 1, lastDayKey: dayKey, active: true } });
      continue;
    }
    if (pair.lastDayKey === dayKey) continue; // already counted today
    const gap = pair.lastDayKey ? daysBetween(pair.lastDayKey, dayKey) : Infinity;
    const count = gap === 1 ? pair.count + 1 : 1;
    await prisma.friendStreak.update({ where: { id: pair.id }, data: { count, lastDayKey: dayKey, active: true } });
    if (MILESTONES.has(count)) await writeActivity(userId, 'FRIEND_STREAK', { friendId: fid, count });
  }
}

export async function getFriendStreaks(userId: string): Promise<Record<string, number>> {
  const rows = await prisma.friendStreak.findMany({ where: { OR: [{ userAId: userId }, { userBId: userId }], active: true, count: { gt: 0 } } });
  const out: Record<string, number> = {};
  for (const r of rows) out[r.userAId === userId ? r.userBId : r.userAId] = r.count;
  return out;
}
