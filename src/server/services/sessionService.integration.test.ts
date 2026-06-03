import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/server/db/prisma';
import { reorderEntries, finishSession, updateEntryTargets } from './sessionService';

let dbReachable = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbReachable = true;
} catch {
  dbReachable = false;
}
const d = dbReachable ? describe : describe.skip;

d('sessionService.reorderEntries (W3-T3)', () => {
  let userId: string;
  let exerciseId: string;
  let sessionId: string;
  let entryIds: string[] = [];

  beforeAll(async () => {
    userId = (await prisma.user.create({ data: { email: `sess-${Date.now()}@test.local`, displayName: 'Sess', status: 'ACTIVE' } })).id;
    exerciseId = (await prisma.exercise.findFirstOrThrow({ where: { ownerId: null } })).id;
    const session = await prisma.workoutSession.create({
      data: {
        ownerId: userId,
        status: 'ACTIVE',
        entries: { create: [0, 1, 2].map((o) => ({ exerciseId, order: o })) },
      },
      include: { entries: { orderBy: { order: 'asc' } } },
    });
    sessionId = session.id;
    entryIds = session.entries.map((e) => e.id);
  });
  afterAll(async () => {
    await prisma.workoutSession.deleteMany({ where: { ownerId: userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it('reverses order without violating @@unique([sessionId, order])', async () => {
    const reversed = [...entryIds].reverse();
    await reorderEntries(userId, sessionId, reversed); // must not throw on the unique constraint
    const rows = await prisma.sessionEntry.findMany({ where: { sessionId }, orderBy: { order: 'asc' } });
    expect(rows.map((r) => r.id)).toEqual(reversed);
    expect(rows.map((r) => r.order)).toEqual([0, 1, 2]);
  });

  it('persists a superset group assignment (W3-T1)', async () => {
    await updateEntryTargets(userId, entryIds[0]!, { supersetGroup: 1 });
    await updateEntryTargets(userId, entryIds[1]!, { supersetGroup: 1 });
    const rows = await prisma.sessionEntry.findMany({ where: { sessionId, supersetGroup: 1 } });
    expect(rows.length).toBe(2);
  });

  it('finishing an already-COMPLETED session is a no-op (W1-T4 service guard)', async () => {
    await prisma.workoutSession.update({ where: { id: sessionId }, data: { status: 'COMPLETED', completedAt: new Date() } });
    const r = await finishSession(userId, sessionId, { saveMode: 'NONE' });
    expect(r.award).toBeNull();
    expect(r.newPrs).toEqual([]);
  });
});
