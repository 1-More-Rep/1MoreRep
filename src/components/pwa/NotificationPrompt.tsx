'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { requestAndSubscribe } from '@/lib/pwa/pushClient';
import { Btn, Icon, Sheet, useToast } from '@/components/ui';

/**
 * One-time, post-install nudge to enable notifications. Shows ONCE per device per
 * account when the app is running as an installed PWA and permission hasn't been
 * decided yet. If the user declines (or it's shown at all), we set a per-user
 * localStorage flag so it never auto-appears again on this device — they can still
 * enable it from Settings. A new device (no flag) or a different account (different
 * key) re-arms the prompt.
 */
export function NotificationPrompt({ vapidPublicKey, userId }: { vapidPublicKey: string | null; userId: string }) {
  const t = useTranslations('notifPrompt');
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = `1mr-notif-prompt:${userId}`;

  useEffect(() => {
    if (!vapidPublicKey) return;
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
    if (!('PushManager' in window) || !('serviceWorker' in navigator)) return;

    // Only inside an installed PWA, and only if permission is still undecided.
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!standalone) return;
    if (Notification.permission !== 'default') return;

    try {
      if (localStorage.getItem(key)) return; // already asked on this device for this user
    } catch {
      return;
    }

    let cancelled = false;
    // Don't already have a subscription? Then nudge — after a short beat so it
    // doesn't slam the user the instant the app opens.
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (cancelled || sub) return;
        const t = setTimeout(() => setOpen(true), 2200);
        return () => clearTimeout(t);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function remember() {
    try {
      localStorage.setItem(key, '1');
    } catch {
      /* ignore */
    }
  }

  function dismiss() {
    remember();
    setOpen(false);
  }

  async function enable() {
    if (!vapidPublicKey) return;
    setBusy(true);
    const res = await requestAndSubscribe(vapidPublicKey);
    setBusy(false);
    remember(); // asked-once, regardless of outcome
    setOpen(false);
    if (res === 'granted') toast(t('enabled'), 'success');
    else if (res === 'denied') toast(t('declined'), 'info');
    else toast(t('failed'), 'error');
  }

  return (
    <Sheet open={open} onClose={dismiss} title={t('title')}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <span
          aria-hidden
          style={{
            width: 42,
            height: 42,
            borderRadius: 'var(--r-sm)',
            background: 'var(--accent-soft)',
            color: 'var(--accent-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="bolt" size={22} stroke={2} />
        </span>
        <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5, margin: 0 }}>
          {t('body')}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
        <Btn kind="ghost" onClick={dismiss} disabled={busy}>{t('notNow')}</Btn>
        <Btn icon="bolt" onClick={enable} disabled={busy}>{busy ? t('enabling') : t('enable')}</Btn>
      </div>
    </Sheet>
  );
}
