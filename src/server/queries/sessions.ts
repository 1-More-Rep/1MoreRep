import 'server-only';
import { prisma } from '@/server/db/prisma';

const entryInclude = {
  entries: {
    orderBy: { order: 'asc' as const },
    include: {
      exercise: { select: { id: true, name: true, iconKey: true, equipment: true } },
      sets: { orderBy: { setIndex: 'asc' as const } },
    },
  },
};

export async function getActiveSession(userId: string) {
  return prisma.workoutSession.findFirst({
    where: { ownerId: userId, status: 'ACTIVE' },
    include: entryInclude,
  });
}

export async function getSessionDetail(id: string, userId: string) {
  const s = await prisma.workoutSession.findUnique({ where: { id }, include: entryInclude });
  if (!s || s.ownerId !== userId) return null;
  return s;
}

export async function getHistory(userId: string, take = 50) {
  return prisma.workoutSession.findMany({
    where: { ownerId: userId, status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
    take,
    include: { entries: { where: { isRemoved: false }, include: { sets: true } } },
  });
}

/** Total volume (kg·reps) over completed sets in a session. */
export function sessionVolume(entries: { sets: { weightKg: number | null; reps: number | null; completed: boolean; isWarmup: boolean }[] }[]): number {
  let v = 0;
  for (const e of entries) for (const s of e.sets) if (s.completed && !s.isWarmup) v += (s.weightKg ?? 0) * (s.reps ?? 0);
  return Math.round(v);
}

export function completedSetCount(entries: { sets: { completed: boolean; isWarmup: boolean }[] }[]): number {
  let n = 0;
  for (const e of entries) for (const s of e.sets) if (s.completed && !s.isWarmup) n++;
  return n;
}

/** completedAt timestamps of a user's COMPLETED sessions (for calendar/heatmap). */
export async function getCompletedSessionDates(userId: string, take = 400): Promise<Date[]> {
  const rows = await prisma.workoutSession.findMany({
    where: { ownerId: userId, status: 'COMPLETED', completedAt: { not: null } },
    orderBy: { completedAt: 'desc' },
    take,
    select: { completedAt: true },
  });
  return rows.map((r) => r.completedAt!).filter(Boolean);
}

export interface UserSessionRow {
  id: string;
  userAgent: string | null;
  label: string | null;
  lastUsedAt: Date;
  createdAt: Date;
  isCurrent: boolean;
}

/** Active login sessions for a user. Never exposes hashedSecret or ipHash. */
export async function listUserSessions(userId: string, currentSessionId: string | null): Promise<UserSessionRow[]> {
  const rows = await prisma.session.findMany({
    where: { userId },
    orderBy: { lastUsedAt: 'desc' },
    select: { id: true, userAgent: true, label: true, lastUsedAt: true, createdAt: true },
  });
  return rows.map((r) => ({ ...r, isCurrent: r.id === currentSessionId }));
}
