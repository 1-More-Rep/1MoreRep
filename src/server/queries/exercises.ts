import 'server-only';
import type { Equipment, Muscle, Prisma } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { est1RM, ONE_RM_CONFIDENT_MAX_REPS } from '@/domain/progression/oneRepMax';

export interface ExerciseFilter {
  q?: string;
  muscle?: Muscle;
  equipment?: Equipment;
  userId: string;
  take?: number;
}

/** Library exercises (ownerId null) plus the current user's custom exercises. */
export async function searchExercises(f: ExerciseFilter) {
  const and: Prisma.ExerciseWhereInput[] = [{ OR: [{ ownerId: null }, { ownerId: f.userId }] }];
  if (f.q) and.push({ name: { contains: f.q, mode: 'insensitive' } });
  if (f.muscle) and.push({ muscleLinks: { some: { muscle: f.muscle, role: 'PRIMARY' } } });
  if (f.equipment) and.push({ equipment: f.equipment });

  return prisma.exercise.findMany({
    where: { AND: and },
    include: { muscleLinks: true },
    orderBy: { name: 'asc' },
    take: f.take ?? 60,
  });
}

export async function getExercise(id: string, userId: string) {
  const ex = await prisma.exercise.findUnique({ where: { id }, include: { muscleLinks: true } });
  if (!ex) return null;
  if (ex.ownerId && ex.ownerId !== userId) return null; // can't view others' custom exercises
  return ex;
}

export async function countExercises(userId: string): Promise<number> {
  return prisma.exercise.count({ where: { OR: [{ ownerId: null }, { ownerId: userId }] } });
}

export interface Est1RmPoint {
  at: Date;
  est1RM: number;
  topWeightKg: number;
  reps: number;
  lowConfidence: boolean; // reps beyond the confident window
}

/**
 * Estimated-1RM history for one exercise: for each COMPLETED session (owned by
 * the user) the top working set (max weight×reps) is mapped through est1RM,
 * giving one point per session ordered by completedAt. Sets above the confident
 * rep window are still included but flagged low-confidence.
 */
export async function getExerciseSetHistory(exerciseId: string, userId: string): Promise<Est1RmPoint[]> {
  const sessions = await prisma.workoutSession.findMany({
    where: {
      ownerId: userId,
      status: 'COMPLETED',
      completedAt: { not: null },
      entries: { some: { exerciseId, isRemoved: false } },
    },
    orderBy: { completedAt: 'asc' },
    select: {
      completedAt: true,
      entries: {
        where: { exerciseId, isRemoved: false },
        select: { sets: { where: { completed: true, isWarmup: false }, select: { weightKg: true, reps: true } } },
      },
    },
  });

  const points: Est1RmPoint[] = [];
  for (const s of sessions) {
    let best: { est: number; weight: number; reps: number } | null = null;
    for (const e of s.entries) {
      for (const set of e.sets) {
        const w = set.weightKg ?? 0;
        const r = set.reps ?? 0;
        if (w <= 0 || r <= 0) continue;
        const est = est1RM(w, r);
        if (!best || est > best.est) best = { est, weight: w, reps: r };
      }
    }
    if (best && s.completedAt) {
      points.push({
        at: s.completedAt,
        est1RM: Math.round(best.est * 10) / 10,
        topWeightKg: best.weight,
        reps: best.reps,
        lowConfidence: best.reps > ONE_RM_CONFIDENT_MAX_REPS,
      });
    }
  }
  return points;
}

/** The exercise the user has logged the most completed working sets for (for the 1RM tab). */
export async function getTopExerciseId(userId: string): Promise<string | null> {
  const grouped = await prisma.sessionEntry.groupBy({
    by: ['exerciseId'],
    where: {
      isRemoved: false,
      session: { ownerId: userId, status: 'COMPLETED' },
      sets: { some: { completed: true, isWarmup: false } },
    },
    _count: { _all: true },
    orderBy: { _count: { exerciseId: 'desc' } },
    take: 1,
  });
  return grouped[0]?.exerciseId ?? null;
}
