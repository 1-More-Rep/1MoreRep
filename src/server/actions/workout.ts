'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth/guards';
import * as svc from '@/server/services/sessionService';
import type { RoutineDiff } from '@/domain/routine/diff';

const ACTIVE = '/app/workout/active';

export async function startWorkoutAction(routineId?: string): Promise<void> {
  const user = await requireUser();
  await svc.startSession(user.id, { routineId });
  redirect(ACTIVE);
}

export async function repeatWorkoutAction(fromSessionId: string): Promise<void> {
  const user = await requireUser();
  await svc.startSession(user.id, { fromSessionId });
  redirect(ACTIVE);
}

export interface UIEntry {
  id: string;
  exerciseId: string;
  exerciseName: string;
  iconKey: string;
  supersetGroup: number | null;
  targetSets: number;
  targetRepLow: number;
  targetRepHigh: number;
  targetRestSec: number;
  sets: { setIndex: number; weightKg: number | null; reps: number | null; rpe: number | null; isWarmup: boolean; completed: boolean }[];
}

export async function addExerciseAction(sessionId: string, exerciseId: string): Promise<UIEntry> {
  const user = await requireUser();
  const e = await svc.addEntry(user.id, sessionId, exerciseId);
  return {
    id: e.id,
    exerciseId: e.exerciseId,
    exerciseName: e.exercise.name,
    iconKey: e.exercise.iconKey,
    supersetGroup: e.supersetGroup,
    targetSets: e.targetSets,
    targetRepLow: e.targetRepLow,
    targetRepHigh: e.targetRepHigh,
    targetRestSec: e.targetRestSec,
    sets: e.sets.map((s) => ({ setIndex: s.setIndex, weightKg: s.weightKg, reps: s.reps, rpe: s.rpe, isWarmup: s.isWarmup, completed: s.completed })),
  };
}

export async function reorderEntriesAction(sessionId: string, orderedEntryIds: string[]): Promise<void> {
  const user = await requireUser();
  await svc.reorderEntries(user.id, sessionId, orderedEntryIds);
  revalidatePath(ACTIVE);
}

export async function removeEntryAction(entryId: string): Promise<void> {
  const user = await requireUser();
  await svc.removeEntry(user.id, entryId);
  revalidatePath(ACTIVE);
}

export async function updateTargetsAction(
  entryId: string,
  data: { targetSets?: number; targetRepLow?: number; targetRepHigh?: number; targetRestSec?: number; targetRpe?: number | null; supersetGroup?: number | null },
): Promise<void> {
  const user = await requireUser();
  await svc.updateEntryTargets(user.id, entryId, data);
  revalidatePath(ACTIVE);
}

export async function logSetAction(
  entryId: string,
  setIndex: number,
  data: { weightKg?: number | null; reps?: number | null; rpe?: number | null; rir?: number | null; isWarmup?: boolean; completed?: boolean },
): Promise<void> {
  const user = await requireUser();
  await svc.logSet(user.id, entryId, setIndex, data);
  revalidatePath(ACTIVE);
}

export async function addSetAction(entryId: string): Promise<void> {
  const user = await requireUser();
  await svc.addSet(user.id, entryId);
  revalidatePath(ACTIVE);
}

export async function deleteSetAction(entryId: string, setIndex: number): Promise<void> {
  const user = await requireUser();
  await svc.deleteSet(user.id, entryId, setIndex);
  revalidatePath(ACTIVE);
}

export async function getWorkoutDiffAction(sessionId: string): Promise<RoutineDiff | null> {
  const user = await requireUser();
  return svc.getSessionDiff(user.id, sessionId);
}

export async function finishWorkoutAction(
  sessionId: string,
  opts: { saveMode: svc.SaveMode; newRoutineName?: string; bodyweightKg?: number; durationSec?: number; notes?: string },
): Promise<void> {
  const user = await requireUser();
  await svc.finishSession(user.id, sessionId, opts);
  redirect(`/app/history/${sessionId}`);
}

export async function abandonWorkoutAction(sessionId: string): Promise<void> {
  const user = await requireUser();
  await svc.abandonSession(user.id, sessionId);
  redirect('/app');
}
