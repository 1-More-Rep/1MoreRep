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

export type LeaderboardKind = 'XP' | 'STREAK' | 'VOLUME';

export async function getLeaderboard(kind: LeaderboardKind, userId: string, limit = 50) {
  const orderBy =
    kind === 'XP' ? { lifetimeXp: 'desc' as const } : kind === 'STREAK' ? { longestStreak: 'desc' as const } : { totalVolume: 'desc' as const };
  const rows = await prisma.userStats.findMany({
    where: {
      user: {
        status: 'ACTIVE',
        // honor leaderboard opt-out (default: opted in)
        OR: [{ privacy: { is: null } }, { privacy: { leaderboardOptIn: true } }],
      },
    },
    include: { user: { select: { displayName: true, publicHandle: true } } },
    orderBy,
    take: limit,
  });
  const value = (s: (typeof rows)[number]) =>
    kind === 'XP' ? s.lifetimeXp : kind === 'STREAK' ? s.longestStreak : Number(s.totalVolume) / 100;
  return rows.map((s, i) => ({
    rank: i + 1,
    name: s.user.publicHandle ?? s.user.displayName,
    value: Math.round(value(s)),
    isSelf: s.userId === userId,
  }));
}
