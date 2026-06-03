import 'server-only';
import { prisma } from '@/server/db/prisma';
import { getOrCreateStats } from '@/server/gamification/stats';
import { levelProgress, weekKey } from '@/domain/gamification/xp';

export async function getStatsBundle(userId: string) {
  const stats = await getOrCreateStats(userId);
  const wk = weekKey(new Date(), 'UTC');
  const membership = await prisma.leagueMembership.findFirst({ where: { userId, cohort: { weekKey: wk } } });
  return {
    stats,
    weeklyXp: membership?.weeklyXp ?? 0,
    progress: levelProgress(stats.lifetimeXp),
    tier: stats.leagueTier,
  };
}

export interface BoardRow {
  rank: number;
  userId: string;
  name: string;
  weeklyXp: number;
  isSelf: boolean;
  zone: 'promote' | 'relegate' | 'hold';
}

const PROMOTE = 7;
const RELEGATE = 5;

export async function getLeagueBoard(userId: string) {
  const wk = weekKey(new Date(), 'UTC');
  const membership = await prisma.leagueMembership.findFirst({ where: { userId, cohort: { weekKey: wk } }, include: { cohort: true } });
  if (!membership) return null;
  const members = await prisma.leagueMembership.findMany({
    where: { cohortId: membership.cohortId },
    include: { user: { select: { displayName: true, publicHandle: true } } },
    orderBy: [{ weeklyXp: 'desc' }],
  });
  const n = members.length;
  const rows: BoardRow[] = members.map((m, i) => ({
    rank: i + 1,
    userId: m.userId,
    name: m.user.publicHandle ?? m.user.displayName,
    weeklyXp: m.weeklyXp,
    isSelf: m.userId === userId,
    zone: i < PROMOTE ? 'promote' : i >= n - RELEGATE ? 'relegate' : 'hold',
  }));
  // weekly settlement at next Monday 00:00 UTC
  const now = new Date();
  const dow = (now.getUTCDay() + 6) % 7; // Mon=0
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + (7 - dow), 0, 0, 0));
  return { tier: membership.cohort.tier, weekKey: wk, rows, settlesAt: next };
}

// Materialized + live leaderboards. WEEKLY_XP is keyed by ISO week; the rest are
// all-time. Display reads materialized snapshots when present (job-built) and
// always derives the viewer's true rank from a full recompute (brute-force).
export type BoardKey = 'WEEKLY_XP' | 'ALLTIME_XP' | 'STREAK' | 'VOLUME' | 'PR';

const OPTED_IN = { status: 'ACTIVE' as const, OR: [{ privacy: { is: null } }, { privacy: { leaderboardOptIn: true } }] };

/** Full descending ranking over opted-in active users for a board. Source of truth. */
export async function buildBoard(board: BoardKey, now: Date = new Date()): Promise<{ userId: string; value: number }[]> {
  const users = await prisma.user.findMany({ where: OPTED_IN, select: { id: true } });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return [];

  let pairs: { userId: string; value: number }[] = [];
  if (board === 'ALLTIME_XP' || board === 'STREAK' || board === 'VOLUME') {
    const stats = await prisma.userStats.findMany({ where: { userId: { in: ids } } });
    pairs = stats.map((s) => ({
      userId: s.userId,
      value: board === 'ALLTIME_XP' ? s.lifetimeXp : board === 'STREAK' ? s.longestStreak : Number(s.totalVolume) / 100,
    }));
  } else if (board === 'WEEKLY_XP') {
    const wk = weekKey(now, 'UTC');
    const grouped = await prisma.xpEvent.groupBy({ by: ['userId'], where: { userId: { in: ids }, weekKey: wk }, _sum: { amount: true } });
    pairs = grouped.map((g) => ({ userId: g.userId, value: g._sum.amount ?? 0 }));
  } else {
    // PR board — count of personal records held
    const grouped = await prisma.personalRecord.groupBy({ by: ['ownerId'], where: { ownerId: { in: ids } }, _count: { _all: true } });
    pairs = grouped.map((g) => ({ userId: g.ownerId, value: g._count._all }));
  }
  return pairs
    .filter((p) => p.value > 0)
    .sort((a, b) => (b.value - a.value) || a.userId.localeCompare(b.userId));
}

export interface BoardRowOut {
  rank: number;
  name: string;
  value: number;
  isSelf: boolean;
}

const snapWeekFor = (board: BoardKey, now: Date) => (board === 'WEEKLY_XP' ? weekKey(now, 'UTC') : 'ALL');

export async function getBoard(board: BoardKey, userId: string, limit = 50, now: Date = new Date()): Promise<{ rows: BoardRowOut[]; self: { rank: number; value: number } | null }> {
  const snaps = await prisma.leaderboardSnapshot.findMany({
    where: { board, weekKey: snapWeekFor(board, now) },
    orderBy: { rank: 'asc' },
    take: limit,
    include: { user: { select: { displayName: true, publicHandle: true } } },
  });

  let rows: BoardRowOut[];
  let full: { userId: string; value: number }[] | null = null;
  if (snaps.length > 0) {
    rows = snaps.map((s) => ({ rank: s.rank, name: s.user.publicHandle ?? s.user.displayName, value: Math.round(s.value), isSelf: s.userId === userId }));
  } else {
    // No snapshot yet (job hasn't run) — materialize-on-read so the board still renders.
    full = await buildBoard(board, now);
    const names = await userNames(full.slice(0, limit).map((f) => f.userId));
    rows = full.slice(0, limit).map((f, i) => ({ rank: i + 1, name: names.get(f.userId) ?? '—', value: Math.round(f.value), isSelf: f.userId === userId }));
  }

  // Pin the viewer's true rank (brute-force recompute) when they're off the board.
  let self: { rank: number; value: number } | null = null;
  if (!rows.some((r) => r.isSelf)) {
    full ??= await buildBoard(board, now);
    const idx = full.findIndex((f) => f.userId === userId);
    if (idx >= 0) self = { rank: idx + 1, value: Math.round(full[idx]!.value) };
  }
  return { rows, self };
}

async function userNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true, publicHandle: true } });
  return new Map(users.map((u) => [u.id, u.publicHandle ?? u.displayName]));
}
