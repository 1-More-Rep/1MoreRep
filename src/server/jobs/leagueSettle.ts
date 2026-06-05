import 'server-only';
import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';
import { settleCohort, nextTier, type CohortMember, type Tier } from '@/domain/gamification/leagues';
import { sendToUser } from '@/server/push';

const JOB = 'league.settle';

/**
 * Settle all ACTIVE cohorts for a week. Idempotent: a completed run (JobRun OK)
 * is a no-op; a crashed run re-processes only the remaining ACTIVE cohorts and is
 * recorded as FAILED so it surfaces in the admin job-health dashboard.
 */
export async function settleLeagues(weekKey: string, now: Date = new Date()): Promise<{ settled: number }> {
  const existing = await prisma.jobRun.findUnique({ where: { job_periodKey: { job: JOB, periodKey: weekKey } } });
  if (existing?.status === 'OK') return { settled: 0 };
  await prisma.jobRun.upsert({
    where: { job_periodKey: { job: JOB, periodKey: weekKey } },
    update: { status: 'RUNNING', startedAt: now, finishedAt: null },
    create: { job: JOB, periodKey: weekKey, status: 'RUNNING' },
  });

  try {
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
        // Settle the member atomically: the membership rank/outcome and the new leagueTier
        // must both land or neither. Previously the tier write was silently `.catch(()=>{})`'d
        // while the rank/outcome write was not, so a failure could leave the member ranked but
        // on the wrong tier with zero error surfaced (and the cohort still flips to SETTLED).
        await prisma.$transaction([
          prisma.leagueMembership.update({ where: { id: mem.id }, data: { rank: r.rank, outcome: r.outcome } }),
          prisma.userStats.update({ where: { userId: r.userId }, data: { leagueTier: newTier } }),
        ]);
        const body =
          r.outcome === 'PROMOTE'
            ? `You finished #${r.rank} and were promoted to ${newTier.toLowerCase()}.`
            : r.outcome === 'RELEGATE'
              ? `You finished #${r.rank} and dropped to ${newTier.toLowerCase()}.`
              : `You finished #${r.rank} and held ${newTier.toLowerCase()}.`;
        await prisma.notification.create({
          data: { userId: r.userId, kind: 'LEAGUE_RESULT', title: `League ${r.outcome.toLowerCase()}`, body, data: { rank: r.rank, outcome: r.outcome, tier: newTier } },
        });
        // Web push (best-effort; respects the user's leagueResults pref + quiet hours).
        // Log on failure rather than swallowing — a dead push pipeline should be visible.
        await sendToUser(r.userId, { title: 'League results are in', body, url: '/app/social/league' }, 'leagueResults').catch((err) => {
          logger.warn({ err, userId: r.userId, job: JOB }, '[league.settle] push notification failed');
        });
      }
      await prisma.leagueCohort.update({ where: { id: cohort.id }, data: { status: 'SETTLED' } });
      settled++;
    }

    await prisma.jobRun.update({ where: { job_periodKey: { job: JOB, periodKey: weekKey } }, data: { status: 'OK', finishedAt: new Date(), detail: { settled } } });
    return { settled };
  } catch (e) {
    await prisma.jobRun.update({
      where: { job_periodKey: { job: JOB, periodKey: weekKey } },
      data: { status: 'FAILED', finishedAt: new Date(), detail: { error: e instanceof Error ? e.message : String(e) } },
    }).catch(() => {});
    throw e;
  }
}
