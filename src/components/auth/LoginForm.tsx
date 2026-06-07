'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { loginAction, magicLinkAction, type ActionState } from '@/server/actions/auth';
import { Btn } from '@/components/ui/Btn';
import { TextField, Alert, SubmitBtn } from './ui';
import { PasskeyLoginButton } from './PasskeyLoginButton';
import { TwoFactorForm } from './TwoFactorForm';

const initial: ActionState = {};

/** Subtle "or" separator between the password form and the passkey button. */
function OrDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-3)' }} aria-hidden>
      <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
      <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
      <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
    </div>
  );
}

export function LoginForm() {
  const t = useTranslations('auth');
  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [pwState, pwAction] = useActionState(loginAction, initial);
  const [magicState, magicAction] = useActionState(magicLinkAction, initial);

  // Password was correct but a second factor is required — show the code step.
  if (pwState.twoFactor) return <TwoFactorForm />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {mode === 'password' ? (
        <form action={pwAction} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Alert kind="error">{pwState.error}</Alert>
          <TextField label={t('email')} name="email" type="email" autoComplete="email" required />
          <TextField label={t('password')} name="password" type="password" autoComplete="current-password" required />
          <SubmitBtn icon="arrowR">{t('signIn')}</SubmitBtn>
        </form>
      ) : (
        <form action={magicAction} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Alert kind="error">{magicState.error}</Alert>
          <Alert kind="notice">{magicState.notice}</Alert>
          {!magicState.ok && (
            <>
              <TextField label={t('email')} name="email" type="email" autoComplete="email" required />
              <SubmitBtn icon="arrowR">{t('emailSignInLink')}</SubmitBtn>
            </>
          )}
        </form>
      )}

      <Btn
        kind="ghost"
        size="sm"
        onClick={() => setMode(mode === 'password' ? 'magic' : 'password')}
        style={{ alignSelf: 'center' }}
      >
        {mode === 'password' ? t('useMagicLink') : t('usePassword')}
      </Btn>

      {mode === 'password' && (
        <>
          <OrDivider label={t('or')} />
          <PasskeyLoginButton />
        </>
      )}
    </div>
  );
}
