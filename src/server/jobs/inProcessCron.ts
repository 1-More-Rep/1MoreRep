import 'server-only';
import { runJob } from './index';
import { logger } from '@/lib/logger';

/**
 * In-process scheduler — a single-instance alternative to the supercronic cron
 * sidecar. Enabled with INPROCESS_CRON=true (e.g. a one-container deployment that
 * doesn't run the sidecar). Started once from Next's `instrumentation.ts`.
 *
 * Dependency-light by design: plain setInterval, aligned to wall-clock boundaries
 * so a 10-minute job fires at :00/:10/:20… and hourly jobs fire on the hour —
 * matching deploy/crontab. Jobs self-gate on time/idempotency, so exact alignment
 * isn't required for correctness; it just keeps the two schedulers consistent.
 *
 * Must never run in tests, never on the client, and never twice in one process.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

type Schedule = { jobs: string[]; everyMs: number };

const SCHEDULES: Schedule[] = [
  { jobs: ['leaderboard.refresh', 'award.reconcile'], everyMs: 10 * MINUTE },
  { jobs: ['streak.rollover', 'streak.risk.notify', 'league.settle'], everyMs: HOUR },
];

let started = false;

async function fire(job: string): Promise<void> {
  try {
    const result = await runJob(job);
    logger.info({ job, result }, '[inProcessCron] job ok');
  } catch (err) {
    // Swallow — a failed tick must not crash the scheduler. runJob already records
    // FAILED JobRun detail; this is just the operational breadcrumb.
    logger.error({ err, job }, '[inProcessCron] job failed');
  }
}

function runDue(jobs: string[]): void {
  // Sequential, fire-and-forget — keep load gentle and ordering deterministic.
  void (async () => {
    for (const job of jobs) await fire(job);
  })();
}

/**
 * Start the in-process scheduler. No-ops unless INPROCESS_CRON==='true', and is
 * idempotent (safe if `register()` runs more than once). Intervals are unref'd so
 * they never keep the process alive on their own.
 */
export function startInProcessCron(): void {
  if (started) return;
  if (process.env.INPROCESS_CRON !== 'true') return;
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return;
  started = true;

  logger.info('[inProcessCron] enabled — scheduling jobs in-process');

  const now = Date.now();
  for (const { jobs, everyMs } of SCHEDULES) {
    // Align the first tick to the next wall-clock boundary, then run every everyMs.
    const delay = everyMs - (now % everyMs);
    const align = setTimeout(() => {
      runDue(jobs);
      const interval = setInterval(() => runDue(jobs), everyMs);
      if (typeof interval.unref === 'function') interval.unref();
    }, delay);
    if (typeof align.unref === 'function') align.unref();
  }
}
