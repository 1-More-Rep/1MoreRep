'use client';

import { subscribePushAction } from '@/server/actions/push';

export function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const buffer = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return buffer;
}

export type SubscribeResult = 'granted' | 'denied' | 'error';

/** Request notification permission and register a push subscription. Shared by the
 *  settings PushManager and the one-time post-install prompt. */
export async function requestAndSubscribe(vapidPublicKey: string): Promise<SubscribeResult> {
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return 'denied';
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToBuffer(vapidPublicKey),
    });
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    await subscribePushAction({ endpoint: json.endpoint, keys: json.keys });
    return 'granted';
  } catch {
    return 'error';
  }
}
