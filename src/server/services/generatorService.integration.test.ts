import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/server/db/prisma';
import { buildHistory, createSessionFromPlan } from './generatorService';
import type { GeneratorPlan } from '@/domain/generator/types';

let dbReachable = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbReachable = true;
} catch {
  dbReachable = false;
}
const d = dbReachable ? describe : describe.skip;

async function makeUser(suffix: string) {
  return prisma.user.create({ data: { email: `gen-${suffix}-${Date.now()}@test.local`, displayName: `Gen ${suffix}`, status: 'ACTIVE' } });
}

async function makeExercise(ownerId: string) {
  return prisma.exercise.create({
    data: { slug: `gen-ex-${Date.now()}`, name: 'Test Bench', category: 'STRENGTH', equipment: 'BARBELL', isCustom: true, ownerId, defaultRepHigh: 10 },
  });
}

/** A completed session whose top working set hit `reps` at `rir`. */
async function completedSetSession(ownerId: string, exerciseId: string, reps: number, rir: number, targetRepHigh: number) {
  return prisma.workoutSession.create({
    data: {
      ownerId,
      status: 'COMPLETED',
      completedAt: new Date(),
      entries: {
        create: {
          exerciseId,
          order: 0,
          targetRepHigh,
          sets: { create: [{ setIndex: 1, weightKg: 100, reps, rir, completed: true }] },
        },
      },
    },
  });
}

d('generatorService.buildHistory (W1-T2)', () => {
  let userId: string;
  let exerciseId: string;

  beforeAll(async () => {
    userId = (await makeUser('hist')).id;
    exerciseId = (await makeExercise(userId)).id;
    await prisma.personalRecord.create({ data: { ownerId: userId, exerciseId, kind: 'EST_1RM', value: 120, unit: 'kg' } });
  });
  afterAll(async () => {
    await prisma.workoutSession.deleteMany({ where: { ownerId: userId } });
    await prisma.personalRecord.deleteMany({ where: { ownerId: userId } });
    await prisma.exercise.deleteMany({ where: { ownerId: userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it('flags hitTopRangeLowRir when the last top set met targetRepHigh at low RIR', async () => {
    await completedSetSession(userId, exerciseId, 10, 1, 10); // reps>=10, rir<=1
    const history = await buildHistory(userId);
    expect(history[exerciseId]).toBeDefined();
    expect(history[exerciseId]!.est1RM).toBe(120);
    expect(history[exerciseId]!.hitTopRangeLowRir).toBe(true);
  });
});

d('generatorService.buildHistory — no bump when reps/RIR fall short', () => {
  let userId: string;
  let exerciseId: string;
  beforeAll(async () => {
    userId = (await makeUser('hist2')).id;
    exerciseId = (await makeExercise(userId)).id;
    await prisma.personalRecord.create({ data: { ownerId: userId, exerciseId, kind: 'EST_1RM', value: 120, unit: 'kg' } });
  });
  afterAll(async () => {
    await prisma.workoutSession.deleteMany({ where: { ownerId: userId } });
    await prisma.personalRecord.deleteMany({ where: { ownerId: userId } });
    await prisma.exercise.deleteMany({ where: { ownerId: userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it('does not flag when the top set fell short of targetRepHigh', async () => {
    await completedSetSession(userId, exerciseId, 6, 0, 10); // strong RIR but reps<10
    const history = await buildHistory(userId);
    expect(history[exerciseId]!.hitTopRangeLowRir).toBe(false);
  });
});

d('generatorService.createSessionFromPlan persists suggested load (W1-T3)', () => {
  let userId: string;
  let exerciseId: string;
  beforeAll(async () => {
    userId = (await makeUser('load')).id;
    exerciseId = (await makeExercise(userId)).id;
  });
  afterAll(async () => {
    await prisma.workoutSession.deleteMany({ where: { ownerId: userId } });
    await prisma.personalRecord.deleteMany({ where: { ownerId: userId } });
    await prisma.exercise.deleteMany({ where: { ownerId: userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it('carries loadSuggestionKg into the session entry and pre-fills set weight', async () => {
    const plan: GeneratorPlan = {
      rationale: [],
      exercises: [
        { exerciseId, name: 'Test Bench', primaryMuscle: 'CHEST', sets: 3, repLow: 6, repHigh: 10, restSec: 120, rpeTarget: 8, loadSuggestionKg: 102.5 },
      ],
    };
    const sessionId = await createSessionFromPlan(userId, plan, 'Generated');
    const entry = await prisma.sessionEntry.findFirstOrThrow({ where: { sessionId }, include: { sets: { orderBy: { setIndex: 'asc' } } } });
    expect(entry.targetLoadKg).toBe(102.5);
    expect(entry.sets[0]!.weightKg).toBe(102.5);
  });
});
