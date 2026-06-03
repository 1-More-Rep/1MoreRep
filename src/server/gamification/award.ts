import 'server-only';
import type { Prisma, XpEventType } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import {
  DAILY_XP_CAP,
  MAX_PR_AWARDS_PER_DAY,
  MAX_XP_WORKOUTS_PER_DAY,
  VOLUME_MILESTONES,
  XP,
  dayKey,
  weekKey,
  isQualifyingSet,
  levelForXp,
  setXp,
} from '@/domain/gamification/xp';
import { registerActivity, type StreakState } from '@/domain/gamification/streak';
import { getOrCreateStats, ensureLeagueMembership } from './stats';

export interface AwardResult {
  xpAwarded: number;
  streak: number;
  leveledUp: boolean;
  newLevel: number;
}

interface PendingEvent {
  type: XpEventType;
  raw: number;
  amount: number;
  meta: Prisma.InputJsonValue;
}

/** Award XP + advance streak/level/volume/league when a workout is completed. */
export async function awardForWorkout(userId: string, sessionId: string, prCount: number, now: Date = new Date()): Promise<AwardResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const tz = user?.timezone ?? 'UTC';
  const dk = dayKey(now, tz); // daily caps reset at the user's local midnight
  const wk = weekKey(now, 'UTC'); // leagues + weekly XP use a single global week

  const entries = await prisma.sessionEntry.findMany({
    where: { sessionId, isRemoved: false },
    include: { exercise: { select: { equipment: true } }, sets: true },
  });
  let qualifying = 0;
  let volumeCentiKg = 0;
  for (const e of entries) {
    const isBodyweight = e.exercise.equipment === 'BODYWEIGHT';
    for (const s of e.sets) {
      if (isQualifyingSet({ reps: s.reps, weightKg: s.weightKg, isWarmup: s.isWarmup, completed: s.completed, isBodyweight })) {
        qualifying++;
        volumeCentiKg += Math.round((s.weightKg ?? 0) * (s.reps ?? 0) * 100);
      }
    }
  }

  const todays = await prisma.xpEvent.findMany({ where: { userId, dayKey: dk } });
  const already = todays.reduce((a, e) => a + e.amount, 0);
  const setsToday = todays.filter((e) => e.type === 'SET').reduce((a, e) => a + ((e.meta as { sets?: number } | null)?.sets ?? 0), 0);
  const workoutsToday = todays.filter((e) => e.type === 'WORKOUT_COMPLETE').length;
  const prAwardsToday = todays.filter((e) => e.type === 'PR').reduce((a, e) => a + ((e.meta as { count?: number } | null)?.count ?? 0), 0);

  const events: PendingEvent[] = [];
  let remaining = DAILY_XP_CAP - already;
  const emit = (type: XpEventType, raw: number, meta: Prisma.InputJsonValue) => {
    if (raw <= 0 || remaining <= 0) return;
    const amount = Math.max(0, Math.min(raw, remaining));
    events.push({ type, raw, amount, meta });
    remaining -= amount;
  };

  // streak (live increment)
  const stats = await getOrCreateStats(userId);
  const streakState: StreakState = { current: stats.currentStreak, longest: stats.longestStreak, lastActiveDay: stats.lastActiveDay, freezes: stats.freezesAvail };
  const streakRes = registerActivity(streakState, dk);
  if (streakRes.changed) emit('STREAK_DAY', XP.STREAK_DAY, {});

  if (qualifying >= 3 && workoutsToday < MAX_XP_WORKOUTS_PER_DAY) emit('WORKOUT_COMPLETE', XP.WORKOUT, {});

  const prCapped = Math.max(0, Math.min(prCount, MAX_PR_AWARDS_PER_DAY - prAwardsToday));
  if (prCapped > 0) emit('PR', prCapped * XP.PR, { count: prCapped });

  let setRaw = 0;
  for (let k = 1; k <= qualifying; k++) setRaw += setXp(setsToday + k);
  if (setRaw > 0) emit('SET', setRaw, { sets: qualifying });

  const newTotalVolume = stats.totalVolume + BigInt(volumeCentiKg);
  const oldKgReps = Number(stats.totalVolume) / 100;
  const newKgReps = Number(newTotalVolume) / 100;
  for (const ms of VOLUME_MILESTONES) {
    if (oldKgReps < ms && newKgReps >= ms) emit('VOLUME_MILESTONE', XP.VOLUME_MILESTONE, { milestone: ms });
  }

  const xpSum = events.reduce((a, e) => a + e.amount, 0);
  const newLifetime = stats.lifetimeXp + xpSum;
  const newLevel = levelForXp(newLifetime);

  await prisma.$transaction([
    ...events.map((e) =>
      prisma.xpEvent.create({
        data: { userId, type: e.type, amount: e.amount, rawAmount: e.raw, workoutId: sessionId, meta: e.meta, occurredAt: now, dayKey: dk, weekKey: wk },
      }),
    ),
    prisma.userStats.update({
      where: { userId },
      data: {
        lifetimeXp: newLifetime,
        level: newLevel,
        currentStreak: streakRes.state.current,
        longestStreak: streakRes.state.longest,
        lastActiveDay: streakRes.state.lastActiveDay,
        freezesAvail: streakRes.state.freezes,
        totalVolume: newTotalVolume,
        totalSessions: { increment: 1 },
      },
    }),
  ]);

  // league weekly XP
  const membershipId = await ensureLeagueMembership(userId, wk, stats.leagueTier);
  if (xpSum > 0) await prisma.leagueMembership.update({ where: { id: membershipId }, data: { weeklyXp: { increment: xpSum } } });

  return { xpAwarded: xpSum, streak: streakRes.state.current, leveledUp: newLevel > stats.level, newLevel };
}
