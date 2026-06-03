import 'server-only';
import webpush from 'web-push';
import type { NotificationPreference } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { localHour } from '@/domain/gamification/xp';
import { logger } from '@/lib/logger';

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

function vapidConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let vapidSet = false;
function ensureVapid() {
  if (vapidSet) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  vapidSet = true;
}

/** True if `hour` falls within [start, end) (handles overnight wrap). */
export function inQuietHours(hour: number, start: number | null, end: number | null): boolean {
  if (start == null || end == null) return false;
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

export async function saveSubscription(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent?: string): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent, failureCount: 0 },
    create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent },
  });
}

export async function removeSubscription(userId: string, endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** Send a push to all of a user's devices, honoring prefs + quiet hours; prunes dead subs. */
export async function sendToUser(userId: string, payload: PushPayload, prefKey?: keyof NotificationPreference): Promise<{ sent: number; reason?: string }> {
  if (!vapidConfigured()) return { sent: 0, reason: 'vapid-not-configured' };

  const prefs = await prisma.notificationPreference.findUnique({ where: { userId } });
  if (prefKey && prefs && prefs[prefKey] === false) return { sent: 0, reason: 'pref-disabled' };

  if (prefs?.quietHoursStart != null && prefs.quietHoursEnd != null) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    if (inQuietHours(localHour(new Date(), user?.timezone || 'UTC'), prefs.quietHoursStart, prefs.quietHoursEnd)) {
      return { sent: 0, reason: 'quiet-hours' };
    }
  }

  ensureVapid();
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload));
      await prisma.pushSubscription.update({ where: { id: s.id }, data: { lastSuccessAt: new Date(), failureCount: 0 } });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      } else {
        await prisma.pushSubscription.update({ where: { id: s.id }, data: { failureCount: { increment: 1 } } }).catch(() => {});
        logger.warn({ code, userId }, 'push send failed');
      }
    }
  }
  return { sent };
}
