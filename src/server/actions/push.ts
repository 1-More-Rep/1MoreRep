'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/server/db/prisma';
import { saveSubscription, removeSubscription, sendToUser } from '@/server/push';

export interface PushState {
  error?: string;
  notice?: string;
}

export async function subscribePushAction(sub: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const ua = (await headers()).get('user-agent') ?? undefined;
  await saveSubscription(user.id, sub, ua);
  return { ok: true };
}

export async function unsubscribePushAction(endpoint: string): Promise<void> {
  const user = await requireUser();
  await removeSubscription(user.id, endpoint);
}

export async function sendTestPushAction(): Promise<{ sent: number; reason?: string }> {
  const user = await requireUser();
  return sendToUser(user.id, { title: '1MoreRep', body: 'Push notifications are working 🎉', url: '/app' });
}

export async function updateNotifPrefsAction(_prev: PushState, formData: FormData): Promise<PushState> {
  const user = await requireUser();
  const bool = (k: string) => formData.get(k) === 'on';
  const num = (k: string) => {
    const v = formData.get(k);
    return v === null || v === '' ? null : Math.max(0, Math.min(23, Number(v)));
  };
  await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    update: {
      streakAtRisk: bool('streakAtRisk'),
      restTimerDone: bool('restTimerDone'),
      friendActivity: bool('friendActivity'),
      leagueResults: bool('leagueResults'),
      workoutReminder: bool('workoutReminder'),
      quietHoursStart: num('quietHoursStart'),
      quietHoursEnd: num('quietHoursEnd'),
    },
    create: {
      userId: user.id,
      streakAtRisk: bool('streakAtRisk'),
      restTimerDone: bool('restTimerDone'),
      friendActivity: bool('friendActivity'),
      leagueResults: bool('leagueResults'),
      workoutReminder: bool('workoutReminder'),
      quietHoursStart: num('quietHoursStart'),
      quietHoursEnd: num('quietHoursEnd'),
    },
  });
  revalidatePath('/app/settings/notifications');
  return { notice: 'Notification settings saved.' };
}
