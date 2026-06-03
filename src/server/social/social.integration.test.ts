import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/server/db/prisma';
import { sendFriendRequest, respondToRequest, areFriends, searchUsersByHandle, listFriends, blockUser } from './friends';
import { canView } from './privacy';
import { evaluateFriendStreaks } from './friendStreak';
import { buildBoard } from '@/server/queries/gamification';

let dbReachable = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbReachable = true;
} catch {
  dbReachable = false;
}
const d = dbReachable ? describe : describe.skip;

d('social', () => {
  let a: string;
  let b: string;
  let c: string;
  const tag = Date.now();

  beforeAll(async () => {
    const mk = (n: string, handle: string, searchable = true) =>
      prisma.user.create({ data: { email: `soc-${n}-${tag}@test.local`, displayName: `Soc ${n}`, publicHandle: `${handle}${tag}`, status: 'ACTIVE', privacy: { create: { searchableByHandle: searchable } } } });
    a = (await mk('a', 'aa')).id;
    b = (await mk('b', 'bb')).id;
    c = (await mk('c', 'cc', false)).id; // not searchable
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [a, b, c] } } });
  });

  it('friend request flow: send -> pending -> accept -> friends', async () => {
    const r = await sendFriendRequest(a, `bb${tag}`);
    expect(r.ok).toBe(true);
    expect(await areFriends(a, b)).toBe(false);
    await respondToRequest(b, a, true);
    expect(await areFriends(a, b)).toBe(true);
  });

  it('public projection never exposes email', async () => {
    const friends = await listFriends(a);
    expect(friends.length).toBeGreaterThan(0);
    expect(friends[0]).not.toHaveProperty('email');
    expect(Object.keys(friends[0]!)).toEqual(expect.arrayContaining(['id', 'displayName', 'publicHandle']));
  });

  it('search honors searchable flag and excludes blocked users', async () => {
    expect((await searchUsersByHandle(`bb${tag}`, a)).map((u) => u.id)).toContain(b);
    expect((await searchUsersByHandle(`cc${tag}`, a)).map((u) => u.id)).not.toContain(c); // not searchable
    await blockUser(a, b);
    expect((await searchUsersByHandle(`bb${tag}`, a)).map((u) => u.id)).not.toContain(b);
    expect(await areFriends(a, b)).toBe(false); // block removed friendship
  });

  it('canView enforces visibility + blocks', async () => {
    // a and c are strangers (and not blocked)
    expect(await canView(a, c, 'PUBLIC')).toBe(true);
    expect(await canView(a, c, 'FRIENDS')).toBe(false);
    expect(await canView(a, c, 'PRIVATE')).toBe(false);
    expect(await canView(a, a, 'PRIVATE')).toBe(true); // self
    // a blocked b earlier -> even PUBLIC is hidden
    expect(await canView(a, b, 'PUBLIC')).toBe(false);
  });

  it('leaderboard honors opt-out', async () => {
    // buildBoard is the live source of truth (snapshots are a materialized cache).
    await prisma.userStats.create({ data: { userId: c, lifetimeXp: 999999 } });
    expect((await buildBoard('ALLTIME_XP')).some((r) => r.value === 999999)).toBe(true);
    await prisma.privacySettings.update({ where: { userId: c }, data: { leaderboardOptIn: false } });
    expect((await buildBoard('ALLTIME_XP')).some((r) => r.value === 999999)).toBe(false);
  });

  it('friend streak increments when both friends trained recently', async () => {
    // a and c become friends and both have a recent completed session
    await sendFriendRequest(a, `cc${tag}`);
    await respondToRequest(c, a, true);
    const now = new Date();
    for (const uid of [a, c]) {
      await prisma.workoutSession.create({ data: { ownerId: uid, status: 'COMPLETED', completedAt: now } });
    }
    await evaluateFriendStreaks(a, '2026-06-02', now);
    const [x, y] = a < c ? [a, c] : [c, a];
    const pair = await prisma.friendStreak.findUnique({ where: { userAId_userBId: { userAId: x, userBId: y } } });
    expect(pair?.count).toBe(1);
  });

  it('advancing a friend streak awards +10 FRIEND_STREAK_BONUS XP and bumps weeklyXp (W1-T1)', async () => {
    const bonuses = await prisma.xpEvent.findMany({ where: { userId: a, type: 'FRIEND_STREAK_BONUS' } });
    expect(bonuses.length).toBe(1);
    expect(bonuses[0]!.amount).toBe(10);
    const membership = await prisma.leagueMembership.findFirst({ where: { userId: a } });
    expect(membership?.weeklyXp).toBeGreaterThanOrEqual(10);
  });
});
