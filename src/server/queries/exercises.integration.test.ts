import { describe, it, expect } from 'vitest';
import { prisma } from '@/server/db/prisma';
import { MUSCLES } from '@/domain/muscles/taxonomy';

let dbReachable = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbReachable = true;
} catch {
  dbReachable = false;
}
const d = dbReachable ? describe : describe.skip;

d('exercise library (seeded DB)', () => {
  it('seeds a substantial library', async () => {
    const count = await prisma.exercise.count({ where: { source: 'FREE_EXERCISE_DB' } });
    expect(count).toBeGreaterThan(800);
  });

  it('covers all 19 muscles with at least one exercise', async () => {
    const used = await prisma.exerciseMuscle.groupBy({ by: ['muscle'] });
    const usedSet = new Set(used.map((u) => u.muscle));
    for (const m of MUSCLES) {
      expect(usedSet.has(m), `no exercise targets ${m}`).toBe(true);
    }
  });

  it('the bench press has curated chest-dominant weights', async () => {
    const bench = await prisma.exercise.findFirst({
      where: { name: { contains: 'Bench Press', mode: 'insensitive' }, source: 'FREE_EXERCISE_DB' },
      include: { muscleLinks: true },
    });
    expect(bench).toBeTruthy();
    const chest = bench!.muscleLinks.find((l) => l.muscle === 'CHEST');
    expect(chest?.weight).toBe(1.0);
    expect(chest?.role).toBe('PRIMARY');
  });
});
