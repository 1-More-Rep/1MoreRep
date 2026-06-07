'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { Btn } from '@/components/ui/Btn';
import { Alert } from './ui';
import { startPasskeyLoginAction, finishPasskeyLoginAction } from '@/server/actions/twofactor';

/**
 * Passwordless sign-in with a passkey. Hidden on browsers without WebAuthn. On
 * success the server action redirects to /app; we only surface real errors (a
 * user-cancelled prompt is silently ignored).
 */
export function PasskeyLoginButton() {
  const t = useTranslations('auth');
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string>();
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(browserSupportsWebAuthn());
  }, []);

  if (!supported) return null;

  function signIn() {
    setErr(undefined);
    start(async () => {
      const res = await startPasskeyLoginAction();
      if ('error' in res) return setErr(res.error);
      let assertion;
      try {
        assertion = await startAuthentication({ optionsJSON: res.options });
      } catch (e) {
        // NotAllowedError = the user dismissed the prompt or it timed out — silent.
        // Anything else (e.g. SecurityError from an origin/rpID mismatch, or no
        // credential) is a real failure the user needs to see.
        if (e instanceof Error && e.name !== 'NotAllowedError') setErr(t('passkeyError'));
        return;
      }
      const fin = await finishPasskeyLoginAction(assertion);
      if (fin?.error) setErr(fin.error);
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {err && <Alert kind="error">{err}</Alert>}
      <Btn kind="soft" icon="key" full disabled={pending} onClick={signIn}>
        {t('signInPasskey')}
      </Btn>
    </div>
  );
}
