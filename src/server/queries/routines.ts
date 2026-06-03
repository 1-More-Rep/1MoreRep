import 'server-only';
import { prisma } from '@/server/db/prisma';

export async function listRoutines(userId: string) {
  return prisma.routine.findMany({
    where: { ownerId: userId, isArchived: false },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { items: true } }, items: { include: { exercise: { select: { name: true } } }, orderBy: { order: 'asc' } } },
  });
}

export async function getRoutine(id: string, userId: string) {
  const r = await prisma.routine.findUnique({
    where: { id },
    include: { items: { orderBy: { order: 'asc' }, include: { exercise: true } } },
  });
  if (!r || r.ownerId !== userId) return null;
  return r;
}
