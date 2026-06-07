import 'server-only';
import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';
import { awardForWorkout } from '@/server/gamification/award';

// Only recent completions can still be legitimately unawarded; an older gap would
// already have been caught by an earlier run. The grace window skips just-completed
// sessions whose award is still in flight on the request path (avoids racing it).
const LOOKBACK_MS = 24 * 3600_000;
const GRACE_MS = 2 * 60_000;
const BATCH = 200;

/**
 * Recover XP/streak for any COMPLETED workout whose award never ran — e.g. a crash or
 * transient DB failure between completion and the award write left `awardedAt` null
 * (H9). awardForWorkout's atomic awardedAt claim makes this safe to re-run and unable
 * to double-credit (it no-ops if the award has since landed). Also GCs expired rows
 * from the persistent rate-limit store (L13) so that table stays small.
 */
export async function reconcileAwards(now: Date = new Date()): Promise<{ scanned: number; reconciled: number; rateLimitGc: number }> {
  const since = new Date(now.getTime() - LOOKBACK_MS);
  const before = new Date(now.getTime() - GRACE_MS);
  const pending = await prisma.workoutSession.findMany({
    where: { status: 'COMPLETED', awardedAt: null, completedAt: { gte: since, lt: before } },
    select: { id: true, ownerId: true },
    orderBy: { completedAt: 'asc' },
    take: BATCH,
  });

  let reconciled = 0;
  for (const s of pending) {
    try {
      // prCount 0: PR records (applySessionPrs) were applied idempotently on the original
      // finish; this recovers the lost XP/streak credit, which is computed from the sets.
      await awardForWorkout(s.ownerId, s.id, 0, now);
      reconciled++;
      logger.warn({ sessionId: s.id, userId: s.ownerId }, '[award.reconcile] recovered un-awarded completed workout');
    } catch (err) {
      logger.error({ err, sessionId: s.id }, '[award.reconcile] failed to reconcile workout');
    }
  }

  const gc = await prisma.rateLimit.deleteMany({ where: { expiresAt: { lt: now } } }).catch(() => ({ count: 0 }));

  return { scanned: pending.length, reconciled, rateLimitGc: gc.count };
}
