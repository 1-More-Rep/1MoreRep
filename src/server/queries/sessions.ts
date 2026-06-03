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
