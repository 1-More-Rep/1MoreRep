import 'server-only';
import { prisma } from '@/server/db/prisma';
import { settleCohort, nextTier, type CohortMember, type Tier } from '@/domain/gamification/leagues';

const JOB = 'league.settle';

/**
 * Settle all ACTIVE cohorts for a week. Idempotent: a completed run (JobRun OK)
 * is a no-op; a crashed run re-processes only the remaining ACTIVE cohorts.
 */
export async function settleLeagues(weekKey: string, now: Date = new Date()): Promise<{ settled: number }> {
  const existing = await prisma.jobRun.findUnique({ where: { job_periodKey: { job: JOB, periodKey: weekKey } } });
  if (existing?.status === 'OK') return { settled: 0 };
  await prisma.jobRun.upsert({
    where: { job_periodKey: { job: JOB, periodKey: weekKey } },
    update: { status: 'RUNNING', startedAt: now, finishedAt: null },
    create: { job: JOB, periodKey: weekKey, status: 'RUNNING' },
  });

  let settled = 0;
  const cohorts = await prisma.leagueCohort.findMany({
    where: { weekKey, status: 'ACTIVE' },
    include: { members: { include: { user: { include: { stats: true } } } } },
  });

  for (const cohort of cohorts) {
    const members: CohortMember[] = cohort.members.map((m) => ({ userId: m.userId, weeklyXp: m.weeklyXp, tiebreak: m.user.stats?.lifetimeXp ?? 0 }));
    const results = settleCohort(members, cohort.tier as Tier);
    for (const r of results) {
      const mem = cohort.members.find((m) => m.userId === r.userId)!;
      const newTier = nextTier(cohort.tier as Tier, r.outcome);
      await prisma.leagueMembership.update({ where: { id: mem.id }, data: { rank: r.rank, outcome: r.outcome } });
      await prisma.userStats.update({ where: { userId: r.userId }, data: { leagueTier: newTier } }).catch(() => {});
      await prisma.notification.create({
        data: {
          userId: r.userId,
          kind: 'LEAGUE_RESULT',
          title: `League ${r.outcome.toLowerCase()}`,
          body:
            r.outcome === 'PROMOTE'
              ? `You finished #${r.rank} and were promoted to ${newTier.toLowerCase()}.`
              : r.outcome === 'RELEGATE'
                ? `You finished #${r.rank} and dropped to ${newTier.toLowerCase()}.`
                : `You finished #${r.rank} and held ${newTier.toLowerCase()}.`,
          data: { rank: r.rank, outcome: r.outcome, tier: newTier },
        },
      });
    }
    await prisma.leagueCohort.update({ where: { id: cohort.id }, data: { status: 'SETTLED' } });
    settled++;
  }

  await prisma.jobRun.update({ where: { job_periodKey: { job: JOB, periodKey: weekKey } }, data: { status: 'OK', finishedAt: new Date(), detail: { settled } } });
  return { settled };
}
