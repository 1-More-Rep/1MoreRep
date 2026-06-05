'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Goal } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { requireUser, AuthorizationError } from '@/lib/auth/guards';

export interface RoutineState {
  error?: string;
}

async function ownRoutine(id: string, userId: string) {
  const r = await prisma.routine.findUnique({ where: { id } });
  if (!r) throw new Error('Routine not found');
  if (r.ownerId !== userId) throw new AuthorizationError();
  return r;
}

const createSchema = z.object({ name: z.string().trim().min(2).max(60), goal: z.enum(['HYPERTROPHY', 'STRENGTH', 'ENDURANCE', 'GENERAL', '']).optional() });

export async function createRoutineAction(_prev: RoutineState, formData: FormData): Promise<RoutineState> {
  const user = await requireUser();
  const parsed = createSchema.safeParse({ name: formData.get('name'), goal: formData.get('goal') || undefined });
  if (!parsed.success) return { error: 'Enter a routine name.' };
  const routine = await prisma.routine.create({
    data: { ownerId: user.id, name: parsed.data.name, goal: (parsed.data.goal || null) as Goal | null },
  });
  redirect(`/app/workouts/${routine.id}`);
}

export async function addRoutineItemAction(routineId: string, exerciseId: string): Promise<void> {
  const user = await requireUser();
  await ownRoutine(routineId, user.id);
  const ex = await prisma.exercise.findUnique({ where: { id: exerciseId } });
  if (!ex) throw new Error('Exercise not found');
  const max = await prisma.routineItem.aggregate({ where: { routineId }, _max: { order: true } });
  await prisma.routineItem.create({
    data: {
      routineId,
      exerciseId,
      order: (max._max.order ?? -1) + 1,
      targetSets: ex.defaultSets,
      targetRepLow: ex.defaultRepLow,
      targetRepHigh: ex.defaultRepHigh,
      targetRestSec: ex.defaultRestSec,
    },
  });
  revalidatePath(`/app/workouts/${routineId}`);
}

// A server action's parameter types are erased at runtime — the client can send any
// shape. Validate explicitly (`.strict()` rejects extra keys, so no mass-assignment of
// other RoutineItem columns) and clamp every numeric to a sane domain range.
const routineItemUpdateSchema = z
  .object({
    targetSets: z.number().int().min(1).max(20).optional(),
    targetRepLow: z.number().int().min(1).max(100).optional(),
    targetRepHigh: z.number().int().min(1).max(100).optional(),
    targetRestSec: z.number().int().min(0).max(3600).optional(),
    supersetGroup: z.number().int().min(0).max(50).nullable().optional(),
  })
  .strict();

export async function updateRoutineItemAction(
  itemId: string,
  data: { targetSets?: number; targetRepLow?: number; targetRepHigh?: number; targetRestSec?: number; supersetGroup?: number | null },
): Promise<void> {
  const user = await requireUser();
  const parsed = routineItemUpdateSchema.safeParse(data);
  if (!parsed.success) throw new Error('Invalid routine item update.');
  const item = await prisma.routineItem.findUnique({ where: { id: itemId }, include: { routine: true } });
  if (!item || item.routine.ownerId !== user.id) throw new AuthorizationError();
  await prisma.routineItem.update({ where: { id: itemId }, data: parsed.data });
  revalidatePath(`/app/workouts/${item.routineId}`);
}

export async function reorderRoutineItemsAction(routineId: string, orderedItemIds: string[]): Promise<void> {
  const user = await requireUser();
  await ownRoutine(routineId, user.id);
  // Renumber EVERY item from the DB, requiring the client list to be a permutation of the
  // routine's real items. A partial/foreign list would otherwise leave unlisted items at
  // their old order and collide with the contiguous 0..n-1 we assign (@@unique P2002).
  const all = await prisma.routineItem.findMany({ where: { routineId }, select: { id: true } });
  const idSet = new Set(all.map((i) => i.id));
  const ordered = orderedItemIds.filter((id) => idSet.has(id));
  if (ordered.length !== idSet.size || new Set(ordered).size !== idSet.size) {
    throw new Error("reorder list must be a permutation of the routine's items");
  }
  const OFFSET = 100000;
  await prisma.$transaction([
    ...ordered.map((id, i) => prisma.routineItem.update({ where: { id }, data: { order: i + OFFSET } })),
    ...ordered.map((id, i) => prisma.routineItem.update({ where: { id }, data: { order: i } })),
  ]);
  revalidatePath(`/app/workouts/${routineId}`);
}

export async function removeRoutineItemAction(itemId: string): Promise<void> {
  const user = await requireUser();
  const item = await prisma.routineItem.findUnique({ where: { id: itemId }, include: { routine: true } });
  if (!item || item.routine.ownerId !== user.id) throw new AuthorizationError();
  await prisma.routineItem.delete({ where: { id: itemId } });
  revalidatePath(`/app/workouts/${item.routineId}`);
}

export async function deleteRoutineAction(routineId: string): Promise<void> {
  const user = await requireUser();
  await ownRoutine(routineId, user.id);
  await prisma.routine.update({ where: { id: routineId }, data: { isArchived: true } });
  redirect('/app/workouts');
}
