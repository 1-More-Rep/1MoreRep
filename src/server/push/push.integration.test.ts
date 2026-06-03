import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const { sendNotification } = vi.hoisted(() => ({ sendNotification: vi.fn() }));
vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification } }));

import { prisma } from '@/server/db/prisma';
import { sendToUser, sendWorkoutReminder, inQuietHours, saveSubscription } from './index';
import { sendFriendRequest, respondToRequest } from '@/server/social/friends';

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

d('workout-reminder trigger (sendWorkoutReminder → sendToUser)', () => {
  let userId: string;
  beforeAll(async () => {
    process.env.VAPID_PUBLIC_KEY = 'test-pub';
    process.env.VAPID_PRIVATE_KEY = 'test-priv';
    userId = (await prisma.user.create({ data: { email: `wr-${Date.now()}@test.local`, displayName: 'WR', status: 'ACTIVE', timezone: 'UTC' } })).id;
    await saveSubscription(userId, { endpoint: `https://push.example/wr-${userId}`, keys: { p256dh: 'p', auth: 'a' } });
  });
  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });
  beforeEach(() => {
    sendNotification.mockReset();
    sendNotification.mockResolvedValue({});
  });

  it('sends with the workoutReminder pref key', async () => {
    const r = await sendWorkoutReminder(userId);
    expect(r.sent).toBe(1);
    expect(sendNotification).toHaveBeenCalledOnce();
  });

  it('honors a disabled workoutReminder preference', async () => {
    await prisma.notificationPreference.upsert({ where: { userId }, update: { workoutReminder: false }, create: { userId, workoutReminder: false } });
    const r = await sendWorkoutReminder(userId);
    expect(r).toEqual({ sent: 0, reason: 'pref-disabled' });
    expect(sendNotification).not.toHaveBeenCalled();
  });
});

d('friend-activity trigger (friends.ts → sendToUser, friendActivity)', () => {
  let requesterId: string;
  let targetId: string;
  const handle = `fa${Date.now()}`;

  beforeAll(async () => {
    process.env.VAPID_PUBLIC_KEY = 'test-pub';
    process.env.VAPID_PRIVATE_KEY = 'test-priv';
    requesterId = (await prisma.user.create({ data: { email: `fa-req-${Date.now()}@test.local`, displayName: 'Req', status: 'ACTIVE', timezone: 'UTC' } })).id;
    targetId = (await prisma.user.create({ data: { email: `fa-tgt-${Date.now()}@test.local`, displayName: 'Tgt', status: 'ACTIVE', timezone: 'UTC', publicHandle: handle } })).id;
    // Each user has a device so the fire-and-forget push actually reaches web-push.
    await saveSubscription(requesterId, { endpoint: `https://push.example/fa-req-${requesterId}`, keys: { p256dh: 'p', auth: 'a' } });
    await saveSubscription(targetId, { endpoint: `https://push.example/fa-tgt-${targetId}`, keys: { p256dh: 'p', auth: 'a' } });
  });
  afterAll(async () => {
    await prisma.friendship.deleteMany({ where: { OR: [{ requesterId }, { addresseeId: requesterId }, { requesterId: targetId }, { addresseeId: targetId }] } }).catch(() => {});
    await prisma.user.delete({ where: { id: requesterId } }).catch(() => {});
    await prisma.user.delete({ where: { id: targetId } }).catch(() => {});
  });
  beforeEach(() => {
    sendNotification.mockReset();
    sendNotification.mockResolvedValue({});
  });

  it('pushes the target when a friend request is sent', async () => {
    const r = await sendFriendRequest(requesterId, handle);
    expect(r.ok).toBe(true);
    // push is fire-and-forget; let the microtask + sendToUser resolve.
    await new Promise((res) => setTimeout(res, 50));
    expect(sendNotification).toHaveBeenCalledOnce();
  });

  it('pushes the original requester when the request is accepted', async () => {
    await respondToRequest(targetId, requesterId, true);
    await new Promise((res) => setTimeout(res, 50));
    expect(sendNotification).toHaveBeenCalledOnce();
  });

  it('respects a disabled friendActivity preference', async () => {
    await prisma.friendship.deleteMany({ where: { OR: [{ requesterId }, { addresseeId: requesterId }] } });
    await prisma.notificationPreference.upsert({ where: { userId: targetId }, update: { friendActivity: false }, create: { userId: targetId, friendActivity: false } });
    const r = await sendFriendRequest(requesterId, handle);
    expect(r.ok).toBe(true);
    await new Promise((res) => setTimeout(res, 50));
    expect(sendNotification).not.toHaveBeenCalled();
  });
});
