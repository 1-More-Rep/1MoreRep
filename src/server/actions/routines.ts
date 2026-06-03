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

export async function updateRoutineItemAction(
  itemId: string,
  data: { targetSets?: number; targetRepLow?: number; targetRepHigh?: number; targetRestSec?: number; supersetGroup?: number | null },
): Promise<void> {
  const user = await requireUser();
  const item = await prisma.routineItem.findUnique({ where: { id: itemId }, include: { routine: true } });
  if (!item || item.routine.ownerId !== user.id) throw new AuthorizationError();
  await prisma.routineItem.update({ where: { id: itemId }, data });
  revalidatePath(`/app/workouts/${item.routineId}`);
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
