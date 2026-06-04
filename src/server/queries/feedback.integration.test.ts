import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/server/db/prisma';
import { listMyFeedback, listAllFeedback, openFeedbackCount } from './feedback';
import { feedbackSchema } from '@/lib/validation/feedback';

let dbReachable = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbReachable = true;
} catch {
  dbReachable = false;
}
const d = dbReachable ? describe : describe.skip;

describe('feedbackSchema', () => {
  it('rejects short messages and unknown categories', () => {
    expect(feedbackSchema.safeParse({ category: 'BUG', message: 'hi' }).success).toBe(false);
    expect(feedbackSchema.safeParse({ category: 'NOPE', message: 'a valid long message' }).success).toBe(false);
    expect(feedbackSchema.safeParse({ category: 'FEATURE', message: 'please add dark mode scheduling' }).success).toBe(true);
  });
});

d('feedback queries', () => {
  let userId: string;
  let otherId: string;

  beforeAll(async () => {
    const tag = Date.now();
    userId = (await prisma.user.create({ data: { email: `fb-${tag}@test.local`, displayName: 'FB User', publicHandle: `fbu${tag}`, status: 'ACTIVE' } })).id;
    otherId = (await prisma.user.create({ data: { email: `fb2-${tag}@test.local`, displayName: 'FB Other', status: 'ACTIVE' } })).id;
    await prisma.feedback.createMany({
      data: [
        { userId, category: 'BUG', status: 'OPEN', message: 'Rest timer drifts by a second.' },
        { userId, category: 'FEATURE', status: 'IN_PROGRESS', message: 'Add a deload week toggle.' },
        { userId, category: 'OTHER', status: 'RESOLVED', message: 'Love the app!' },
        { userId: otherId, category: 'BUG', status: 'CLOSED', message: 'Someone else feedback.' },
      ],
    });
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
  });

  it('listMyFeedback returns only the owner rows, newest first', async () => {
    const mine = await listMyFeedback(userId);
    expect(mine.length).toBe(3);
    expect(mine.every((f) => f.userId === userId)).toBe(true);
    expect(mine[0]!.createdAt.getTime()).toBeGreaterThanOrEqual(mine[mine.length - 1]!.createdAt.getTime());
  });

  it('listAllFeedback projects the submitter without leaking email', async () => {
    const all = await listAllFeedback();
    const row = all.find((f) => f.userId === userId);
    expect(row).toBeTruthy();
    expect(row!.user).toHaveProperty('displayName');
    expect(row!.user).not.toHaveProperty('email');
  });

  it('openFeedbackCount counts OPEN + IN_PROGRESS', async () => {
    const before = await openFeedbackCount();
    expect(before).toBeGreaterThanOrEqual(2); // our OPEN + IN_PROGRESS rows
    const open = await prisma.feedback.findFirst({ where: { userId, status: 'OPEN' } });
    await prisma.feedback.update({ where: { id: open!.id }, data: { status: 'RESOLVED' } });
    expect(await openFeedbackCount()).toBe(before - 1);
  });
});
