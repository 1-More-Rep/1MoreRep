'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth/guards';
import * as svc from '@/server/services/sessionService';
import type { RoutineDiff } from '@/domain/routine/diff';

const ACTIVE = '/app/workout/active';

/** Clamp a finite number into [min, max]; non-finite → null (drops NaN/Infinity). */
function clamp(v: number | null | undefined, min: number, max: number): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  return Math.min(max, Math.max(min, v));
}
const clampInt = (v: number | null | undefined, min: number, max: number): number | null => {
  const c = clamp(v, min, max);
  return c == null ? null : Math.round(c);
};

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
  // Bound every client-supplied numeric to a sane range so a hostile/buggy payload can't
  // write junk (NaN, negatives, absurd values) to the DB.
  const clean = {
    ...(data.targetSets !== undefined ? { targetSets: clampInt(data.targetSets, 1, 50) ?? 1 } : {}),
    ...(data.targetRepLow !== undefined ? { targetRepLow: clampInt(data.targetRepLow, 0, 1000) ?? 0 } : {}),
    ...(data.targetRepHigh !== undefined ? { targetRepHigh: clampInt(data.targetRepHigh, 0, 1000) ?? 0 } : {}),
    ...(data.targetRestSec !== undefined ? { targetRestSec: clampInt(data.targetRestSec, 0, 86_400) ?? 0 } : {}),
    ...(data.targetRpe !== undefined ? { targetRpe: clamp(data.targetRpe, 0, 10) } : {}),
    ...(data.supersetGroup !== undefined ? { supersetGroup: data.supersetGroup == null ? null : clampInt(data.supersetGroup, 0, 1_000_000) } : {}),
  };
  await svc.updateEntryTargets(user.id, entryId, clean);
  revalidatePath(ACTIVE);
}

export async function logSetAction(
  entryId: string,
  setIndex: number,
  data: { weightKg?: number | null; reps?: number | null; rpe?: number | null; rir?: number | null; isWarmup?: boolean; completed?: boolean },
): Promise<void> {
  const user = await requireUser();
  // Bound numerics before persisting (see updateTargetsAction). undefined = "field not
  // sent" (leave untouched); explicit null = clear the field.
  const clean = {
    ...(data.weightKg !== undefined ? { weightKg: clamp(data.weightKg, 0, 10_000) } : {}),
    ...(data.reps !== undefined ? { reps: clampInt(data.reps, 0, 10_000) } : {}),
    ...(data.rpe !== undefined ? { rpe: clamp(data.rpe, 0, 10) } : {}),
    ...(data.rir !== undefined ? { rir: clampInt(data.rir, 0, 50) } : {}),
    ...(data.isWarmup !== undefined ? { isWarmup: data.isWarmup } : {}),
    ...(data.completed !== undefined ? { completed: data.completed } : {}),
  };
  await svc.logSet(user.id, entryId, setIndex, clean);
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
  // Sanitize client-supplied finish payload: clamp duration (never negative/NaN), bound
  // bodyweight, and cap free-text lengths so the DB can't be fed junk or unbounded blobs.
  await svc.finishSession(user.id, sessionId, {
    saveMode: opts.saveMode,
    newRoutineName: opts.newRoutineName?.slice(0, 60),
    bodyweightKg: clamp(opts.bodyweightKg, 0, 1000) ?? undefined,
    durationSec: clampInt(opts.durationSec, 0, 86_400) ?? undefined,
    notes: opts.notes?.slice(0, 5000),
  });
  redirect(`/app/history/${sessionId}`);
}

export async function abandonWorkoutAction(sessionId: string): Promise<void> {
  const user = await requireUser();
  await svc.abandonSession(user.id, sessionId);
  redirect('/app');
}
