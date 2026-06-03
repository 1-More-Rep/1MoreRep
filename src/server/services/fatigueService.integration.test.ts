import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/server/db/prisma';
import { computeAndCacheFatigue, reportSoreness } from './fatigueService';

let dbReachable = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbReachable = true;
} catch {
  dbReachable = false;
}
const d = dbReachable ? describe : describe.skip;

d('fatigue service (DB)', () => {
  let userId: string;

  beforeAll(async () => {
    const u = await prisma.user.create({ data: { email: `fat-${Date.now()}@test.local`, displayName: 'Fat Test', status: 'ACTIVE' } });
    userId = u.id;
    const bench = await prisma.exercise.findFirst({ where: { muscleLinks: { some: { muscle: 'CHEST', role: 'PRIMARY' } }, ownerId: null } });
    if (!bench) throw new Error('no chest exercise seeded');
    await prisma.workoutSession.create({
      data: {
        ownerId: userId,
        status: 'COMPLETED',
        completedAt: new Date(),
        entries: {
          create: {
            exerciseId: bench.id,
            order: 0,
            sets: { create: [{ setIndex: 1, weightKg: 100, reps: 8, completed: true }] },
          },
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.workoutSession.deleteMany({ where: { ownerId: userId } });
    await prisma.muscleFatigueSnapshot.deleteMany({ where: { ownerId: userId } });
    await prisma.sorenessReport.deleteMany({ where: { ownerId: userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it('persists a snapshot that matches the computed fatigue (cache parity)', async () => {
    const now = new Date();
    const computed = await computeAndCacheFatigue(userId, now);
    expect(computed.CHEST.fatigue).toBeGreaterThan(0);
    const snaps = await prisma.muscleFatigueSnapshot.findMany({ where: { ownerId: userId } });
    expect(snaps).toHaveLength(19);
    for (const s of snaps) {
      expect(s.fatigue).toBeCloseTo(computed[s.muscle].fatigue, 6);
    }
  });

  it('is deterministic for a fixed clock and soreness raises fatigue', async () => {
    const now = new Date();
    const a = await computeAndCacheFatigue(userId, now);
    await reportSoreness(userId, 'BICEPS', 10);
    const b = await computeAndCacheFatigue(userId, now);
    expect(b.BICEPS.fatigue).toBeGreaterThan(a.BICEPS.fatigue);
    // chest stimulus unchanged at the same clock
    expect(b.CHEST.fatigue).toBeCloseTo(a.CHEST.fatigue, 6);
  });
});
