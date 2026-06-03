import 'server-only';
import { prisma } from '@/server/db/prisma';
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
    select: { id: true, timezone: true },
  });

  let notified = 0;
  for (const u of users) {
    if (localHour(now, u.timezone) !== RISK_HOUR) continue;
    const today = dayKey(now, u.timezone);
    // did they already train today? (compare a completed session's local dayKey)
    const recent = await prisma.workoutSession.findMany({
      where: { ownerId: u.id, status: 'COMPLETED', completedAt: { gte: new Date(now.getTime() - 36 * 3600_000) } },
      select: { completedAt: true },
    });
    const trainedToday = recent.some((s) => s.completedAt && dayKey(s.completedAt, u.timezone) === today);
    if (trainedToday) continue;

    const res = await sendToUser(u.id, { title: 'Keep your streak alive 🔥', body: 'Train today to keep your streak going.', url: '/app/workout/new' }, 'streakAtRisk');
    if (res.sent > 0) notified++;
  }
  return { notified };
}
