'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { sendTestPushAction, unsubscribePushAction } from '@/server/actions/push';
import { detectPushCapability, type PushCapability } from '@/lib/pwa/ios';
import { requestAndSubscribe } from '@/lib/pwa/pushClient';
import { Btn } from '@/components/ui/Btn';
import { Chip } from '@/components/ui/Chip';
import { SectionLabel } from '@/components/ui/typography';
import { InstallGuide } from './InstallGuide';

export function PushManager({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const t = useTranslations('settingsPages');
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
    const res = await requestAndSubscribe(vapidPublicKey);
    if (res === 'granted') {
      setSubscribed(true);
      setMsg(t('msgEnabled'));
    } else if (res === 'denied') {
      setMsg(t('msgNotAllowed'));
    } else {
      setMsg(t('msgCouldNotEnable'));
    }
    setBusy(false);
  }

  async function test() {
    const r = await sendTestPushAction();
    setMsg(r.sent > 0 ? t('msgTestSent') : r.reason === 'vapid-not-configured' ? t('msgNotConfiguredAdmin') : t('msgNoSubscriptions'));
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
      setMsg(t('msgDisabled'));
    } catch {
      setMsg(t('msgCouldNotDisable'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="push-manager" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionLabel>{t('pushNotifications')}</SectionLabel>
      {!vapidPublicKey ? (
        <Chip>{t('pushNotConfigured')}</Chip>
      ) : cap === 'needs-install' ? (
        <InstallGuide />
      ) : cap === 'unsupported' ? (
        <Chip>{t('pushUnsupported')}</Chip>
      ) : (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Btn kind={subscribed ? 'soft' : 'primary'} size="sm" icon="bolt" disabled={busy} onClick={enable}>
            {subscribed ? t('notificationsOn') : t('enableNotifications')}
          </Btn>
          {subscribed && <Btn kind="ghost" size="sm" onClick={test}>{t('sendTest')}</Btn>}
          {subscribed && <Btn kind="ghost" size="sm" disabled={busy} onClick={disable}>{t('disable')}</Btn>}
        </div>
      )}
      {msg && <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{msg}</span>}
    </div>
  );
}
