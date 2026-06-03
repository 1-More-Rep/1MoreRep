import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { weekKey } from '@/domain/gamification/xp';
import { settleLeagues } from './leagueSettle';
import { streakRollover } from './streakRollover';
import { streakRiskNotify } from './streakRiskNotify';
import { refreshLeaderboards } from './leaderboardRefresh';

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

/**
 * Run a job body inside a JobRun record so failures are observable (status FAILED
 * with error detail) — a crashed run no longer stays stuck RUNNING. league.settle
 * manages its own per-week JobRun (idempotency lock), so it isn't double-wrapped.
 */
async function withJobRun(job: string, now: Date, fn: () => Promise<unknown>): Promise<unknown> {
  const periodKey = now.toISOString().slice(0, 16); // per-minute dispatch bucket
  await prisma.jobRun.upsert({
    where: { job_periodKey: { job, periodKey } },
    update: { status: 'RUNNING', startedAt: now, finishedAt: null },
    create: { job, periodKey, status: 'RUNNING' },
  });
  try {
    const detail = await fn();
    await prisma.jobRun.update({
      where: { job_periodKey: { job, periodKey } },
      data: { status: 'OK', finishedAt: new Date(), detail: (detail ?? {}) as Prisma.InputJsonValue },
    });
    return detail;
  } catch (e) {
    await prisma.jobRun.update({
      where: { job_periodKey: { job, periodKey } },
      data: { status: 'FAILED', finishedAt: new Date(), detail: { error: e instanceof Error ? e.message : String(e) } },
    });
    throw e;
  }
}

/** Dispatch a job by name. Returns a JSON-serializable summary. */
export async function runJob(name: string, now: Date = new Date()): Promise<unknown> {
  switch (name) {
    case 'streak.rollover':
      return withJobRun(name, now, () => streakRollover(now));
    case 'league.settle':
      return settleEndedLeagues(now); // writes its own JobRun (per week) with OK/FAILED
    case 'leaderboard.refresh':
      return withJobRun(name, now, () => refreshLeaderboards(now));
    case 'streak.risk.notify':
      return withJobRun(name, now, () => streakRiskNotify(now));
    default:
      throw new Error(`unknown job: ${name}`);
  }
}
