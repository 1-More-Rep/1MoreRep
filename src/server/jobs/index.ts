import 'server-only';
import { prisma } from '@/server/db/prisma';
import { weekKey } from '@/domain/gamification/xp';
import { settleLeagues } from './leagueSettle';
import { streakRollover } from './streakRollover';
import { streakRiskNotify } from './streakRiskNotify';

export const JOB_NAMES = ['streak.rollover', 'league.settle', 'leaderboard.refresh', 'streak.risk.notify'] as const;
export type JobName = (typeof JOB_NAMES)[number];

/** Settle any past (already-ended) league weeks that are still ACTIVE. */
async function settleEndedLeagues(now: Date) {
  const current = weekKey(now, 'UTC');
  const ended = await prisma.leagueCohort.findMany({
    where: { status: 'ACTIVE', weekKey: { lt: current } },
    distinct: ['weekKey'],
    select: { weekKey: true },
  });
  let settled = 0;
  for (const w of ended) settled += (await settleLeagues(w.weekKey, now)).settled;
  return { settledCohorts: settled, weeks: ended.length };
}

/** Dispatch a job by name. Returns a JSON-serializable summary. */
export async function runJob(name: string, now: Date = new Date()): Promise<unknown> {
  switch (name) {
    case 'streak.rollover':
      return streakRollover(now);
    case 'league.settle':
      return settleEndedLeagues(now);
    case 'leaderboard.refresh':
      // Leaderboards are computed live from UserStats (P9); nothing to materialize yet.
      return { ok: true };
    case 'streak.risk.notify':
      return streakRiskNotify(now);
    default:
      throw new Error(`unknown job: ${name}`);
  }
}
