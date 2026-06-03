import 'server-only';
import type { Equipment, ExCategory } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { computeAndCacheFatigue } from './fatigueService';
import { generateWorkout } from '@/domain/generator/engine';
import type { GenGoal, GeneratorInput, GeneratorPlan, PoolExercise } from '@/domain/generator/types';
import { MUSCLES, type Muscle } from '@/domain/muscles/taxonomy';

const RESISTANCE_CATEGORIES = ['STRENGTH', 'POWERLIFTING', 'OLYMPIC', 'STRONGMAN'] as const;
const HOUR = 3600_000;

export interface GenerateOptions {
  goal: GenGoal;
  availableTimeMin: number;
  equipment?: Equipment[];
}

/** Per-muscle weekly hard-set volume (fractional, by muscle weight) over 7 days. */
async function weeklyVolumeByMuscle(userId: string, now: Date): Promise<Record<Muscle, number>> {
  const since = new Date(now.getTime() - 7 * 24 * HOUR);
  const sessions = await prisma.workoutSession.findMany({
    where: { ownerId: userId, status: 'COMPLETED', completedAt: { gte: since } },
    include: { entries: { where: { isRemoved: false }, include: { exercise: { include: { muscleLinks: true } }, sets: true } } },
  });
  const vol = {} as Record<Muscle, number>;
  for (const m of MUSCLES) vol[m] = 0;
  for (const s of sessions) {
    for (const e of s.entries) {
      const workingSets = e.sets.filter((st) => st.completed && !st.isWarmup).length;
      if (workingSets === 0) continue;
      for (const link of e.exercise.muscleLinks) vol[link.muscle] += workingSets * link.weight;
    }
  }
  return vol;
}

async function buildPool(userId: string, equipment?: Equipment[]): Promise<PoolExercise[]> {
  const exercises = await prisma.exercise.findMany({
    where: {
      OR: [{ ownerId: null }, { ownerId: userId }],
      category: { in: [...RESISTANCE_CATEGORIES] as ExCategory[] },
      ...(equipment && equipment.length ? { equipment: { in: equipment } } : {}),
    },
    include: { muscleLinks: true },
    take: 600,
  });
  return exercises
    .filter((e) => e.muscleLinks.length > 0)
    .map((e) => ({
      id: e.id,
      slug: e.slug,
      name: e.name,
      mechanic: e.mechanic,
      equipment: e.equipment,
      defaultRestSec: e.defaultRestSec,
      muscleWeights: e.muscleLinks.map((m) => ({ muscle: m.muscle, weight: m.weight, role: m.role })),
    }));
}

async function buildHistory(userId: string) {
  const prs = await prisma.personalRecord.findMany({ where: { ownerId: userId, kind: 'EST_1RM' } });
  const history: GeneratorInput['history'] = {};
  for (const p of prs) history[p.exerciseId] = { est1RM: p.value, hitTopRangeLowRir: false };
  return history;
}

async function recentlyUsedExerciseIds(userId: string): Promise<string[]> {
  const recent = await prisma.workoutSession.findMany({
    where: { ownerId: userId, status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
    take: 2,
    include: { entries: { select: { exerciseId: true } } },
  });
  return [...new Set(recent.flatMap((s) => s.entries.map((e) => e.exerciseId)))];
}

export async function generatePlan(userId: string, opts: GenerateOptions, now: Date = new Date()): Promise<GeneratorPlan> {
  const [fatigue, volume, pool, history, recentlyUsed] = await Promise.all([
    computeAndCacheFatigue(userId, now),
    weeklyVolumeByMuscle(userId, now),
    buildPool(userId, opts.equipment),
    buildHistory(userId),
    recentlyUsedExerciseIds(userId),
  ]);

  const perMuscle = {} as GeneratorInput['perMuscle'];
  for (const m of MUSCLES) perMuscle[m] = { fatigue: fatigue[m].fatigue, weeklyVolume: volume[m] };

  return generateWorkout({
    goal: opts.goal,
    availableTimeMin: opts.availableTimeMin,
    experience: 'INTERMEDIATE',
    perMuscle,
    pool,
    history,
    recentlyUsed,
  });
}

/** Materialize a generated plan as a fresh ACTIVE session and return its id. */
export async function createSessionFromPlan(userId: string, plan: GeneratorPlan, name = 'Generated workout', goal?: GenGoal): Promise<string> {
  await prisma.workoutSession.updateMany({ where: { ownerId: userId, status: 'ACTIVE' }, data: { status: 'ABANDONED' } });
  const session = await prisma.workoutSession.create({
    data: {
      ownerId: userId,
      name,
      goal: goal ?? undefined,
      status: 'ACTIVE',
      entries: {
        create: plan.exercises.map((ex, i) => ({
          exerciseId: ex.exerciseId,
          order: i,
          originRoutineItemId: null,
          targetSets: ex.sets,
          targetRepLow: ex.repLow,
          targetRepHigh: ex.repHigh,
          targetRestSec: ex.restSec,
          targetRpe: ex.rpeTarget,
          sets: { create: Array.from({ length: ex.sets }, (_, j) => ({ setIndex: j + 1, completed: false })) },
        })),
      },
    },
  });
  return session.id;
}
