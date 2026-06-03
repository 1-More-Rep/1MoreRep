import 'server-only';
import type { PrKind } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { exercisePrCandidates, pickNewPrs, type SetData } from '@/domain/progression/prs';

export interface NewPr {
  exerciseId: string;
  exerciseName: string;
  kind: PrKind;
  value: number;
  unit: string;
}

/**
 * Recompute PRs from a completed session and persist any that beat the prior
 * best. Returns the new PRs (for the finish summary). Idempotent: re-running on
 * the same session won't create duplicates (it only upserts on improvement).
 */
export async function applySessionPrs(userId: string, sessionId: string): Promise<NewPr[]> {
  const entries = await prisma.sessionEntry.findMany({
    where: { sessionId, isRemoved: false },
    include: { sets: true, exercise: { select: { id: true, name: true } } },
  });

  // group sets by exercise
  const byExercise = new Map<string, { name: string; sets: SetData[] }>();
  for (const e of entries) {
    const bucket = byExercise.get(e.exerciseId) ?? { name: e.exercise.name, sets: [] };
    for (const s of e.sets) {
      bucket.sets.push({ weightKg: s.weightKg, reps: s.reps, isWarmup: s.isWarmup, completed: s.completed, setLogId: s.id });
    }
    byExercise.set(e.exerciseId, bucket);
  }

  const exerciseIds = [...byExercise.keys()];
  const priorPrs = await prisma.personalRecord.findMany({ where: { ownerId: userId, exerciseId: { in: exerciseIds } } });
  const priorByExercise = new Map<string, Partial<Record<PrKind, number>>>();
  for (const p of priorPrs) {
    const m = priorByExercise.get(p.exerciseId) ?? {};
    m[p.kind] = p.value;
    priorByExercise.set(p.exerciseId, m);
  }

  const newPrs: NewPr[] = [];
  for (const [exerciseId, { name, sets }] of byExercise) {
    const candidates = exercisePrCandidates(sets);
    const fresh = pickNewPrs(candidates, priorByExercise.get(exerciseId) ?? {});
    for (const c of fresh) {
      await prisma.personalRecord.upsert({
        where: { ownerId_exerciseId_kind: { ownerId: userId, exerciseId, kind: c.kind } },
        update: { value: c.value, unit: c.unit, setLogId: c.setLogId, sessionId, achievedAt: new Date() },
        create: { ownerId: userId, exerciseId, kind: c.kind, value: c.value, unit: c.unit, setLogId: c.setLogId, sessionId },
      });
      newPrs.push({ exerciseId, exerciseName: name, kind: c.kind, value: c.value, unit: c.unit });
    }
  }
  return newPrs;
}
