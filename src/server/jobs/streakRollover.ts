import 'server-only';
import { prisma } from '@/server/db/prisma';
import { dayKey, localHour } from '@/domain/gamification/xp';
import { rolloverInto, type StreakState } from '@/domain/gamification/streak';

/**
 * Run hourly. For each active-streak user whose local time just crossed midnight,
 * preserve (freeze) or reset their streak if yesterday was missed. Idempotent
 * within a day: a frozen/reset state won't be re-applied on the next hourly tick.
 */
export async function streakRollover(now: Date = new Date()): Promise<{ processed: number; reset: number; frozen: number }> {
  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE', stats: { currentStreak: { gt: 0 } } },
    select: { id: true, timezone: true, stats: true },
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

    await prisma.userStats.update({
      where: { userId: u.id },
      data: { currentStreak: res.state.current, lastActiveDay: res.state.lastActiveDay, freezesAvail: res.state.freezes },
    });
    if (res.outcome === 'reset') {
      reset++;
      await prisma.notification.create({ data: { userId: u.id, kind: 'STREAK_RISK', title: 'Streak reset', body: 'Your daily streak reset — start a fresh one today!' } });
    } else {
      frozen++;
    }
    processed++;
  }

  return { processed, reset, frozen };
}
