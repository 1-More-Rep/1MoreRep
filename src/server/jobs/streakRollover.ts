import 'server-only';
import { prisma } from '@/server/db/prisma';
import { dayKey, localHour } from '@/domain/gamification/xp';
import { rolloverInto, type StreakState } from '@/domain/gamification/streak';
import { getTranslator } from '@/i18n/translator';

/**
 * Run hourly. For each active-streak user whose local time just crossed midnight,
 * preserve (freeze) or reset their streak if yesterday was missed. Idempotent
 * within a day: a frozen/reset state won't be re-applied on the next hourly tick.
 */
export async function streakRollover(now: Date = new Date()): Promise<{ processed: number; reset: number; frozen: number }> {
  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE', stats: { currentStreak: { gt: 0 } } },
    select: { id: true, timezone: true, locale: true, stats: true },
  });

  let processed = 0;
  let reset = 0;
  let frozen = 0;

  for (const u of users) {
    if (!u.stats) continue;
    if (localHour(now, u.timezone) !== 0) continue; // only at the user's local midnight hour
    const today = dayKey(now, u.timezone);
    const state: StreakState = { current: u.stats.currentStreak, longest: u.stats.longestStreak, lastActiveDay: u.stats.lastActiveDay, freezes: u.stats.freezesAvail };
    const res = rolloverInto(state, today);
    if (res.outcome === 'intact') continue;

    const statsUpdate = prisma.userStats.update({
      where: { userId: u.id },
      data: { currentStreak: res.state.current, lastActiveDay: res.state.lastActiveDay, freezesAvail: res.state.freezes },
    });
    if (res.outcome === 'reset') {
      // Atomic: reset the streak and record the notification together, so a crash can't
      // leave a streak silently reset with no row explaining it to the user. Rendered in
      // the user's locale + keyed so the in-app feed can re-localize.
      const t = getTranslator(u.locale);
      await prisma.$transaction([
        statsUpdate,
        prisma.notification.create({
          data: {
            userId: u.id,
            kind: 'STREAK_RISK',
            title: t('notifications.streakReset.title' as never) as string,
            body: t('notifications.streakReset.body' as never) as string,
            titleKey: 'notifications.streakReset.title',
            bodyKey: 'notifications.streakReset.body',
          },
        }),
      ]);
      reset++;
    } else {
      await statsUpdate;
      frozen++;
    }
    processed++;
  }

  return { processed, reset, frozen };
}
