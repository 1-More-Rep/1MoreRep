import 'server-only';
import type { UserStats } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { COHORT_SIZE } from '@/domain/gamification/leagues';

export async function getOrCreateStats(userId: string): Promise<UserStats> {
  return prisma.userStats.upsert({ where: { userId }, update: {}, create: { userId } });
}

/** Ensure the user has a league membership for the given week (drafting a cohort of their tier). */
export async function ensureLeagueMembership(userId: string, weekKey: string, tier: string): Promise<string> {
  const existing = await prisma.leagueMembership.findFirst({ where: { userId, cohort: { weekKey } } });
  if (existing) return existing.id;

  // find an active cohort of this tier/week with space, else create one
  const cohorts = await prisma.leagueCohort.findMany({
    where: { tier, weekKey, status: 'ACTIVE' },
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: 'asc' },
  });
  let cohortId = cohorts.find((c) => c._count.members < COHORT_SIZE)?.id;
  if (!cohortId) {
    cohortId = (await prisma.leagueCohort.create({ data: { tier, weekKey, status: 'ACTIVE' } })).id;
  }

  try {
    const m = await prisma.leagueMembership.create({ data: { cohortId, userId, weeklyXp: 0 } });
    return m.id;
  } catch {
    // unique race — fetch the existing membership
    const m = await prisma.leagueMembership.findFirst({ where: { userId, cohort: { weekKey } } });
    return m!.id;
  }
}
