import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/server/db/prisma';
import { awardForWorkout, awardFriendStreakBonus } from './award';
import { settleLeagues } from '@/server/jobs/leagueSettle';
import { runJob } from '@/server/jobs';

let dbReachable = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbReachable = true;
} catch {
  dbReachable = false;
}
const d = dbReachable ? describe : describe.skip;

async function makeUser(suffix: string) {
  return prisma.user.create({ data: { email: `gam-${suffix}-${Date.now()}@test.local`, displayName: `Gam ${suffix}`, status: 'ACTIVE', timezone: 'UTC' } });
}

async function completedSession(userId: string, exerciseId: string, completedAt: Date, sets = 3) {
  return prisma.workoutSession.create({
    data: {
      ownerId: userId,
      status: 'COMPLETED',
      completedAt,
      entries: { create: { exerciseId, order: 0, sets: { create: Array.from({ length: sets }, (_, i) => ({ setIndex: i + 1, weightKg: 100, reps: 8, completed: true })) } } },
    },
  });
}

d('XP award', () => {
  let userId: string;
  let exerciseId: string;
  const now = new Date('2026-06-02T12:00:00Z');

  beforeAll(async () => {
    userId = (await makeUser('xp')).id;
    exerciseId = (await prisma.exercise.findFirstOrThrow({ where: { ownerId: null } })).id;
  });
  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it('awards set + workout + streak XP and advances the streak', async () => {
    const s = await completedSession(userId, exerciseId, now, 3);
    const r = await awardForWorkout(userId, s.id, 0, now);
    // 3 sets (5+5+5) + workout 25 + streak 15 = 55
    expect(r.xpAwarded).toBe(55);
    expect(r.streak).toBe(1);

    const events = await prisma.xpEvent.findMany({ where: { userId } });
    const types = events.map((e) => e.type);
    expect(types).toContain('SET');
    expect(types).toContain('WORKOUT_COMPLETE');
    expect(types).toContain('STREAK_DAY');

    const stats = await prisma.userStats.findUniqueOrThrow({ where: { userId } });
    expect(stats.lifetimeXp).toBe(55);
    expect(stats.currentStreak).toBe(1);

    const membership = await prisma.leagueMembership.findFirst({ where: { userId } });
    expect(membership?.weeklyXp).toBe(55);
  });

  it('does not re-award the streak on a second workout the same day', async () => {
    const s = await completedSession(userId, exerciseId, now, 2);
    const before = await prisma.userStats.findUniqueOrThrow({ where: { userId } });
    const r = await awardForWorkout(userId, s.id, 0, now);
    const after = await prisma.userStats.findUniqueOrThrow({ where: { userId } });
    expect(after.currentStreak).toBe(1); // unchanged
    expect(after.lifetimeXp).toBeGreaterThan(before.lifetimeXp); // sets + workout still awarded
    expect(r.xpAwarded).toBeGreaterThan(0);
  });

  it('is idempotent: re-awarding the same session adds no XP or ledger rows (W1-T4)', async () => {
    const s = await completedSession(userId, exerciseId, now, 3);
    const r1 = await awardForWorkout(userId, s.id, 1, now);
    expect(r1.xpAwarded).toBeGreaterThan(0);
    const xpAfter1 = (await prisma.userStats.findUniqueOrThrow({ where: { userId } })).lifetimeXp;
    const rows1 = await prisma.xpEvent.count({ where: { userId } });

    const r2 = await awardForWorkout(userId, s.id, 1, now); // re-finish / retry
    expect(r2.xpAwarded).toBe(0);
    const xpAfter2 = (await prisma.userStats.findUniqueOrThrow({ where: { userId } })).lifetimeXp;
    const rows2 = await prisma.xpEvent.count({ where: { userId } });
    expect(xpAfter2).toBe(xpAfter1);
    expect(rows2).toBe(rows1);
  });

  it('friend-streak bonus caps at 3/day (W1-T1)', async () => {
    const u = await makeUser('fsb');
    const dk = '2026-06-02';
    for (let i = 0; i < 4; i++) await awardFriendStreakBonus(u.id, dk, now);
    const events = await prisma.xpEvent.findMany({ where: { userId: u.id, type: 'FRIEND_STREAK_BONUS' } });
    expect(events.length).toBe(3); // 4th advance awards nothing
    expect(events.reduce((a, e) => a + e.amount, 0)).toBe(30);
    await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
  });
});

d('league settlement', () => {
  const wk = `2099-W01`;
  let userIds: string[] = [];
  let cohortId: string;

  beforeAll(async () => {
    const users = await Promise.all(Array.from({ length: 30 }, (_, i) => makeUser(`lg${i}`)));
    userIds = users.map((u) => u.id);
    await prisma.userStats.createMany({ data: userIds.map((id) => ({ userId: id, leagueTier: 'GOLD', lifetimeXp: 0 })) });
    const cohort = await prisma.leagueCohort.create({ data: { tier: 'GOLD', weekKey: wk, status: 'ACTIVE' } });
    cohortId = cohort.id;
    await prisma.leagueMembership.createMany({ data: userIds.map((id, i) => ({ cohortId, userId: id, weeklyXp: (30 - i) * 10 })) });
  });
  afterAll(async () => {
    await prisma.jobRun.deleteMany({ where: { periodKey: wk } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it('promotes 7, relegates 5, holds 18 and is idempotent', async () => {
    const r1 = await settleLeagues(wk);
    expect(r1.settled).toBe(1);
    const members = await prisma.leagueMembership.findMany({ where: { cohortId }, orderBy: { rank: 'asc' } });
    expect(members.filter((m) => m.outcome === 'PROMOTE')).toHaveLength(7);
    expect(members.filter((m) => m.outcome === 'RELEGATE')).toHaveLength(5);
    expect(members.filter((m) => m.outcome === 'HOLD')).toHaveLength(18);
    // top promoted to platinum, bottom relegated to silver
    const top = await prisma.userStats.findUniqueOrThrow({ where: { userId: members[0]!.userId } });
    expect(top.leagueTier).toBe('PLATINUM');

    // idempotent: a settled run is a no-op
    const r2 = await settleLeagues(wk);
    expect(r2.settled).toBe(0);
  });
});

d('job dispatch', () => {
  it('runs known jobs and rejects unknown', async () => {
    await expect(runJob('leaderboard.refresh')).resolves.toBeTruthy();
    await expect(runJob('streak.rollover', new Date('2026-06-02T05:00:00Z'))).resolves.toBeTruthy();
    await expect(runJob('bogus')).rejects.toThrow(/unknown job/);
  });
});
