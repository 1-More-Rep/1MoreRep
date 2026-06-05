import 'server-only';
import type { Prisma, XpEventType } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import {
  DAILY_XP_CAP,
  MAX_FRIEND_STREAK_BONUSES_PER_DAY,
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
  meta: Prisma.InputJsonValue;
}

export interface XpContext {
  now: Date;
  dk: string; // user-local day key (daily caps reset at local midnight)
  wk: string; // global ISO week key (leagues + weekly XP)
  workoutId?: string; // stamped on every event in this batch (dedupe anchor)
}

interface XpCommit {
  xpAwarded: number;
  newLevel: number;
  leveledUp: boolean;
}

/**
 * Shared, daily-capped XP writer. Applies the remaining-budget clamp to each
 * pending event in order, writes the ledger rows, bumps lifetime XP/level (+ any
 * extra UserStats fields), and increments the user's weekly league XP.
 * Used by both the workout award and the friend-streak bonus so the daily cap
 * accounting is consistent across producers.
 */
export async function awardXp(
  userId: string,
  pending: PendingEvent[],
  ctx: XpContext,
  extraStats: Prisma.UserStatsUpdateInput = {},
): Promise<XpCommit> {
  // Sum today's XP in the DB rather than loading every row into memory just to add it up.
  const spent = await prisma.xpEvent.aggregate({ where: { userId, dayKey: ctx.dk }, _sum: { amount: true } });
  let remaining = DAILY_XP_CAP - (spent._sum.amount ?? 0);

  const events: (PendingEvent & { amount: number })[] = [];
  for (const p of pending) {
    if (p.raw <= 0 || remaining <= 0) continue;
    const amount = Math.max(0, Math.min(p.raw, remaining));
    if (amount <= 0) continue;
    events.push({ ...p, amount });
    remaining -= amount;
  }

  const xpSum = events.reduce((a, e) => a + e.amount, 0);
  const stats = await getOrCreateStats(userId);
  // lifetimeXp is written as an atomic { increment } (not an absolute read-modify-write)
  // so concurrent producers — e.g. a friend-streak bonus racing the user's own workout
  // award — can't silently clobber each other's XP. level is derived from the read for
  // the leveled-up signal and self-corrects on the next award if it briefly lags.
  const newLevel = levelForXp(stats.lifetimeXp + xpSum);

  // Resolve the membership up-front (ensureLeagueMembership is an idempotent upsert) so the
  // weekly-XP increment can join the SAME transaction as the ledger rows + lifetime bump.
  // Previously it was a separate write: a crash between them left weeklyXp / the leaderboard
  // permanently diverged from lifetimeXp. Now all three commit atomically or not at all.
  const membershipId = await ensureLeagueMembership(userId, ctx.wk, stats.leagueTier);

  await prisma.$transaction([
    ...events.map((e) =>
      prisma.xpEvent.create({
        data: {
          userId,
          type: e.type,
          amount: e.amount,
          rawAmount: e.raw,
          workoutId: ctx.workoutId,
          meta: e.meta,
          occurredAt: ctx.now,
          dayKey: ctx.dk,
          weekKey: ctx.wk,
        },
      }),
    ),
    prisma.userStats.update({
      where: { userId },
      data: { lifetimeXp: { increment: xpSum }, level: newLevel, ...extraStats },
    }),
    ...(xpSum > 0
      ? [prisma.leagueMembership.update({ where: { id: membershipId }, data: { weeklyXp: { increment: xpSum } } })]
      : []),
  ]);

  return { xpAwarded: xpSum, newLevel, leveledUp: newLevel > stats.level };
}

/** Award XP + advance streak/level/volume/league when a workout is completed. */
export async function awardForWorkout(userId: string, sessionId: string, prCount: number, now: Date = new Date()): Promise<AwardResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const tz = user?.timezone ?? 'UTC';
  const dk = dayKey(now, tz); // daily caps reset at the user's local midnight
  const wk = weekKey(now, 'UTC'); // leagues + weekly XP use a single global week

  // Idempotency safety net (W1-T4): never double-credit a workout. The primary
  // guard is finishSession short-circuiting on an already-COMPLETED session;
  // this catches any other re-entry (retry / direct re-invocation).
  const alreadyAwarded = await prisma.xpEvent.findFirst({ where: { userId, workoutId: sessionId } });
  if (alreadyAwarded) {
    const stats = await getOrCreateStats(userId);
    return { xpAwarded: 0, streak: stats.currentStreak, leveledUp: false, newLevel: stats.level };
  }

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
  const setsToday = todays.filter((e) => e.type === 'SET').reduce((a, e) => a + ((e.meta as { sets?: number } | null)?.sets ?? 0), 0);
  const workoutsToday = todays.filter((e) => e.type === 'WORKOUT_COMPLETE').length;
  const prAwardsToday = todays.filter((e) => e.type === 'PR').reduce((a, e) => a + ((e.meta as { count?: number } | null)?.count ?? 0), 0);

  const pending: PendingEvent[] = [];

  // streak (live increment)
  const stats = await getOrCreateStats(userId);
  const streakState: StreakState = { current: stats.currentStreak, longest: stats.longestStreak, lastActiveDay: stats.lastActiveDay, freezes: stats.freezesAvail };
  const streakRes = registerActivity(streakState, dk);
  if (streakRes.changed) pending.push({ type: 'STREAK_DAY', raw: XP.STREAK_DAY, meta: {} });

  if (qualifying >= 3 && workoutsToday < MAX_XP_WORKOUTS_PER_DAY) pending.push({ type: 'WORKOUT_COMPLETE', raw: XP.WORKOUT, meta: {} });

  const prCapped = Math.max(0, Math.min(prCount, MAX_PR_AWARDS_PER_DAY - prAwardsToday));
  if (prCapped > 0) pending.push({ type: 'PR', raw: prCapped * XP.PR, meta: { count: prCapped } });

  let setRaw = 0;
  for (let k = 1; k <= qualifying; k++) setRaw += setXp(setsToday + k);
  if (setRaw > 0) pending.push({ type: 'SET', raw: setRaw, meta: { sets: qualifying } });

  const newTotalVolume = stats.totalVolume + BigInt(volumeCentiKg);
  const oldKgReps = Number(stats.totalVolume) / 100;
  const newKgReps = Number(newTotalVolume) / 100;
  for (const ms of VOLUME_MILESTONES) {
    if (oldKgReps < ms && newKgReps >= ms) pending.push({ type: 'VOLUME_MILESTONE', raw: XP.VOLUME_MILESTONE, meta: { milestone: ms } });
  }

  const commit = await awardXp(userId, pending, { now, dk, wk, workoutId: sessionId }, {
    currentStreak: streakRes.state.current,
    longestStreak: streakRes.state.longest,
    lastActiveDay: streakRes.state.lastActiveDay,
    freezesAvail: streakRes.state.freezes,
    // Atomic increment (not an absolute write) so concurrent volume credits don't clobber.
    totalVolume: { increment: BigInt(volumeCentiKg) },
    totalSessions: { increment: 1 },
  });

  return { xpAwarded: commit.xpAwarded, streak: streakRes.state.current, leveledUp: commit.leveledUp, newLevel: commit.newLevel };
}

/**
 * Award the +10 friend-streak bonus to `userId` when one of their friend streaks
 * advances. Capped at MAX_FRIEND_STREAK_BONUSES_PER_DAY/day and the daily XP cap.
 * No-op once the per-day cap is reached.
 */
export async function awardFriendStreakBonus(userId: string, dk: string, now: Date = new Date()): Promise<void> {
  const todaysBonuses = await prisma.xpEvent.count({ where: { userId, dayKey: dk, type: 'FRIEND_STREAK_BONUS' } });
  if (todaysBonuses >= MAX_FRIEND_STREAK_BONUSES_PER_DAY) return;
  const wk = weekKey(now, 'UTC');
  await awardXp(userId, [{ type: 'FRIEND_STREAK_BONUS', raw: XP.FRIEND_STREAK, meta: {} }], { now, dk, wk });
}
