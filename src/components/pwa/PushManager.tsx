'use client';

import { useEffect, useState } from 'react';
import { subscribePushAction, sendTestPushAction, unsubscribePushAction } from '@/server/actions/push';
import { detectPushCapability, type PushCapability } from '@/lib/pwa/ios';
import { Btn } from '@/components/ui/Btn';
import { Chip } from '@/components/ui/Chip';
import { SectionLabel } from '@/components/ui/typography';

function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const buffer = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return buffer;
}

export function PushManager({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [cap, setCap] = useState<PushCapability | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    setCap(detectPushCapability({ ua: navigator.userAgent, standalone, hasPushManager: 'PushManager' in window && 'serviceWorker' in navigator }));
    navigator.serviceWorker?.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, []);

  async function enable() {
    if (!vapidPublicKey) return;
    setBusy(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setMsg('Notifications were not allowed.');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBuffer(vapidPublicKey) });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await subscribePushAction({ endpoint: json.endpoint, keys: json.keys });
      setSubscribed(true);
      setMsg('Notifications enabled.');
    } catch {
      setMsg('Could not enable notifications.');
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    const r = await sendTestPushAction();
    setMsg(r.sent > 0 ? 'Test sent.' : r.reason === 'vapid-not-configured' ? 'Push is not configured by the admin.' : 'No active device subscriptions.');
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribePushAction(sub.endpoint);
        await sub.unsubscribe().catch(() => {});
      }
      setSubscribed(false);
      setMsg('Notifications disabled.');
    } catch {
      setMsg('Could not disable notifications.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="push-manager" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionLabel>Push notifications</SectionLabel>
      {!vapidPublicKey ? (
        <Chip>Push isn&apos;t configured on this instance yet.</Chip>
      ) : cap === 'needs-install' ? (
        <Chip>On iPhone/iPad, add 1MoreRep to your Home Screen first, then enable notifications.</Chip>
      ) : cap === 'unsupported' ? (
        <Chip>This browser doesn&apos;t support push notifications.</Chip>
      ) : (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Btn kind={subscribed ? 'soft' : 'primary'} size="sm" icon="bolt" disabled={busy} onClick={enable}>
            {subscribed ? 'Notifications on' : 'Enable notifications'}
          </Btn>
          {subscribed && <Btn kind="ghost" size="sm" onClick={test}>Send test</Btn>}
          {subscribed && <Btn kind="ghost" size="sm" disabled={busy} onClick={disable}>Disable</Btn>}
        </div>
      )}
      {msg && <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{msg}</span>}
    </div>
  );
}
