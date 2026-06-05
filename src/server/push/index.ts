import 'server-only';
import webpush from 'web-push';
import type { NotificationPreference } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { localHour } from '@/domain/gamification/xp';
import { logger } from '@/lib/logger';
import { getTranslator } from '@/i18n/translator';

/** A translator bound to a recipient's locale (for building localized payloads). */
export type PushTranslator = ReturnType<typeof getTranslator>;

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

function vapidConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

// Socket timeout for a single push send. Without it a stalled FCM/APNS gateway would
// hang the per-subscription loop indefinitely (web-push has no default timeout).
const PUSH_TIMEOUT_MS = 10_000;

let vapidSet = false;
function ensureVapid() {
  if (vapidSet) return;
  // Read into locals + guard instead of non-null asserting undeclared env vars: if either
  // key is missing we simply don't configure (callers already gate on vapidConfigured()).
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub, priv);
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

/**
 * Send a push to all of a user's devices, honoring prefs + quiet hours; prunes dead subs.
 * The payload may be a static object OR a builder that receives a translator bound to the
 * recipient's locale — so notifications render in the user's language, not the sender's.
 */
export async function sendToUser(
  userId: string,
  payload: PushPayload | ((t: PushTranslator) => PushPayload),
  prefKey?: keyof NotificationPreference,
): Promise<{ sent: number; reason?: string }> {
  if (!vapidConfigured()) return { sent: 0, reason: 'vapid-not-configured' };

  const prefs = await prisma.notificationPreference.findUnique({ where: { userId } });
  if (prefKey && prefs && prefs[prefKey] === false) return { sent: 0, reason: 'pref-disabled' };

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true, locale: true } });

  if (prefs?.quietHoursStart != null && prefs.quietHoursEnd != null) {
    if (inQuietHours(localHour(new Date(), user?.timezone || 'UTC'), prefs.quietHoursStart, prefs.quietHoursEnd)) {
      return { sent: 0, reason: 'quiet-hours' };
    }
  }

  const resolved: PushPayload = typeof payload === 'function' ? payload(getTranslator(user?.locale)) : payload;

  ensureVapid();
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(resolved), { timeout: PUSH_TIMEOUT_MS });
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

/**
 * Nudge a user to come back and train. Honors the `workoutReminder` preference
 * and quiet hours via sendToUser. Producer only — the cron caller lives elsewhere.
 */
export async function sendWorkoutReminder(userId: string): Promise<{ sent: number; reason?: string }> {
  return sendToUser(
    userId,
    (t) => ({
      title: t('push.workoutReminder.title' as never) as string,
      body: t('push.workoutReminder.body' as never) as string,
      url: '/app/workout/new',
      tag: 'workout-reminder',
    }),
    'workoutReminder',
  );
}
