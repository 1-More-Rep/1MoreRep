import 'server-only';
import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';
import { dayKey, localHour } from '@/domain/gamification/xp';
import { sendToUser } from '@/server/push';

const RISK_HOUR = 20; // 8pm local — fires once/day per user

/**
 * Run hourly. Nudge users with an active streak who haven't trained today and
 * are approaching the end of their local day.
 */
export async function streakRiskNotify(now: Date = new Date()): Promise<{ notified: number }> {
  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE', stats: { currentStreak: { gt: 0 } } },
    select: { id: true, timezone: true, locale: true, stats: { select: { lastStreakNudgeDay: true } } },
  });

  let notified = 0;
  for (const u of users) {
    if (localHour(now, u.timezone) !== RISK_HOUR) continue;
    const today = dayKey(now, u.timezone);
    // Idempotency marker: at most one nudge per user per local day. The previous design
    // relied solely on "the 8pm hour ticks exactly once", so a manual "run now" or a
    // duplicate scheduler within that hour re-pushed everyone. lastStreakNudgeDay closes that.
    if (u.stats?.lastStreakNudgeDay === today) continue;
    // did they already train today? (compare a completed session's local dayKey)
    const recent = await prisma.workoutSession.findMany({
      where: { ownerId: u.id, status: 'COMPLETED', completedAt: { gte: new Date(now.getTime() - 36 * 3600_000) } },
      select: { completedAt: true },
    });
    const trainedToday = recent.some((s) => s.completedAt && dayKey(s.completedAt, u.timezone) === today);
    if (trainedToday) continue;

    // Per-user isolation: one user's push failure must not abort the whole batch and
    // leave everyone after them un-nudged. Log and move on.
    try {
      const res = await sendToUser(
        u.id,
        (t) => ({
          title: t('push.streakRisk.title' as never) as string,
          body: t('push.streakRisk.body' as never) as string,
          url: '/app/workout/new',
        }),
        'streakAtRisk',
      );
      // Stamp the marker after a successful (non-throwing) send so a genuine error retries
      // next hour, while a user with simply no subscription isn't re-attempted all evening.
      await prisma.userStats.update({ where: { userId: u.id }, data: { lastStreakNudgeDay: today } });
      if (res.sent > 0) notified++;
    } catch (err) {
      logger.warn({ err, userId: u.id, job: 'streak.risk.notify' }, '[streak.risk.notify] push failed for user');
    }
  }
  return { notified };
}
