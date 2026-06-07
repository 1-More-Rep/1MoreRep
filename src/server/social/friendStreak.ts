import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { daysBetween } from '@/domain/gamification/xp';
import { awardFriendStreakBonus } from '@/server/gamification/award';
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

  // One query for "which friends trained in the window" instead of a findFirst per
  // friend (was N+1). Only the friends who actually trained need streak processing.
  const trained = await prisma.workoutSession.findMany({
    where: { ownerId: { in: friends }, status: 'COMPLETED', completedAt: { gte: since } },
    select: { ownerId: true },
    distinct: ['ownerId'],
  });
  const trainedSet = new Set(trained.map((s) => s.ownerId));
  const trainedFriends = friends.filter((fid) => trainedSet.has(fid));
  if (trainedFriends.length === 0) return;

  // Load every existing streak row for the trained pairs in ONE query (was a
  // findUnique per friend). Pair keys are canonicalized (sorted) exactly as written.
  const canonical = (fid: string) => (userId < fid ? { userAId: userId, userBId: fid } : { userAId: fid, userBId: userId });
  const existing = await prisma.friendStreak.findMany({ where: { OR: trainedFriends.map(canonical) } });
  const byPair = new Map(existing.map((row) => [`${row.userAId}|${row.userBId}`, row]));

  for (const fid of trainedFriends) {
    const { userAId: a, userBId: b } = canonical(fid);
    const pair = byPair.get(`${a}|${b}`);
    if (!pair) {
      try {
        await prisma.friendStreak.create({ data: { userAId: a, userBId: b, count: 1, lastDayKey: dayKey, active: true } });
      } catch (e) {
        // A concurrent first workout for the same pair won the create race (unique
        // constraint on userAId_userBId) — the streak exists, so don't crash.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
      await awardFriendStreakBonus(userId, dayKey, now);
      continue;
    }
    if (pair.lastDayKey === dayKey) continue; // already counted today
    const gap = pair.lastDayKey ? daysBetween(pair.lastDayKey, dayKey) : Infinity;
    const count = gap === 1 ? pair.count + 1 : 1;
    await prisma.friendStreak.update({ where: { id: pair.id }, data: { count, lastDayKey: dayKey, active: true } });
    await awardFriendStreakBonus(userId, dayKey, now);
    if (MILESTONES.has(count)) await writeActivity(userId, 'FRIEND_STREAK', { friendId: fid, count });
  }
}

export async function getFriendStreaks(userId: string): Promise<Record<string, number>> {
  const rows = await prisma.friendStreak.findMany({ where: { OR: [{ userAId: userId }, { userBId: userId }], active: true, count: { gt: 0 } } });
  const out: Record<string, number> = {};
  for (const r of rows) out[r.userAId === userId ? r.userBId : r.userAId] = r.count;
  return out;
}
