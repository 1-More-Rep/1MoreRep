import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/prisma';

export async function addBodyMetric(userId: string, data: { bodyweightKg?: number | null; measurements?: Prisma.InputJsonValue; recordedAt?: Date }) {
  return prisma.bodyMetric.create({
    data: { ownerId: userId, bodyweightKg: data.bodyweightKg ?? null, measurements: data.measurements, recordedAt: data.recordedAt },
  });
}

export async function listBodyMetrics(userId: string, take = 120) {
  return prisma.bodyMetric.findMany({ where: { ownerId: userId }, orderBy: { recordedAt: 'asc' }, take });
}

/** Update an existing entry. Ownership-guarded — no-op (returns null) if not owned. */
export async function updateBodyMetric(
  id: string,
  userId: string,
  data: { bodyweightKg?: number | null; measurements?: Prisma.InputJsonValue; recordedAt?: Date },
) {
  const existing = await prisma.bodyMetric.findUnique({ where: { id }, select: { ownerId: true } });
  if (!existing || existing.ownerId !== userId) return null;
  return prisma.bodyMetric.update({
    where: { id },
    data: {
      ...(data.bodyweightKg !== undefined ? { bodyweightKg: data.bodyweightKg } : {}),
      ...(data.measurements !== undefined ? { measurements: data.measurements } : {}),
      ...(data.recordedAt !== undefined ? { recordedAt: data.recordedAt } : {}),
    },
  });
}

export async function deleteBodyMetric(userId: string, id: string): Promise<void> {
  const m = await prisma.bodyMetric.findUnique({ where: { id } });
  if (m && m.ownerId === userId) await prisma.bodyMetric.delete({ where: { id } });
}
