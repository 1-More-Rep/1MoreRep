import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const { sendNotification } = vi.hoisted(() => ({ sendNotification: vi.fn() }));
vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification } }));

import { prisma } from '@/server/db/prisma';
import { sendToUser, inQuietHours, saveSubscription } from './index';

describe('inQuietHours', () => {
  it('handles same-day and overnight ranges', () => {
    expect(inQuietHours(23, 22, 7)).toBe(true); // overnight
    expect(inQuietHours(3, 22, 7)).toBe(true);
    expect(inQuietHours(12, 22, 7)).toBe(false);
    expect(inQuietHours(13, 9, 17)).toBe(true); // same-day
    expect(inQuietHours(8, 9, 17)).toBe(false);
    expect(inQuietHours(5, null, null)).toBe(false);
  });
});

let dbReachable = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbReachable = true;
} catch {
  dbReachable = false;
}
const d = dbReachable ? describe : describe.skip;

d('sendToUser (mocked web-push)', () => {
  let userId: string;

  beforeAll(async () => {
    process.env.VAPID_PUBLIC_KEY = 'test-pub';
    process.env.VAPID_PRIVATE_KEY = 'test-priv';
    userId = (await prisma.user.create({ data: { email: `push-${Date.now()}@test.local`, displayName: 'Push', status: 'ACTIVE', timezone: 'UTC' } })).id;
    await saveSubscription(userId, { endpoint: `https://push.example/${userId}`, keys: { p256dh: 'p', auth: 'a' } });
  });
  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });
  beforeEach(() => {
    sendNotification.mockReset();
    sendNotification.mockResolvedValue({});
  });

  it('does nothing when VAPID is not configured', async () => {
    const pub = process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PUBLIC_KEY;
    const r = await sendToUser(userId, { title: 't', body: 'b' });
    expect(r).toEqual({ sent: 0, reason: 'vapid-not-configured' });
    process.env.VAPID_PUBLIC_KEY = pub;
  });

  it('sends to active subscriptions', async () => {
    const r = await sendToUser(userId, { title: 't', body: 'b' });
    expect(r.sent).toBe(1);
    expect(sendNotification).toHaveBeenCalledOnce();
  });

  it('respects a disabled preference', async () => {
    await prisma.notificationPreference.upsert({ where: { userId }, update: { streakAtRisk: false }, create: { userId, streakAtRisk: false } });
    const r = await sendToUser(userId, { title: 't', body: 'b' }, 'streakAtRisk');
    expect(r.sent).toBe(0);
    expect(r.reason).toBe('pref-disabled');
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('suppresses during quiet hours', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true } });
    const hour = new Date().getUTCHours(); // user tz is UTC
    await prisma.notificationPreference.update({ where: { userId }, data: { streakAtRisk: true, quietHoursStart: hour, quietHoursEnd: (hour + 1) % 24 } });
    expect(user.timezone).toBe('UTC');
    const r = await sendToUser(userId, { title: 't', body: 'b' });
    expect(r.reason).toBe('quiet-hours');
    expect(sendNotification).not.toHaveBeenCalled();
  });
});
