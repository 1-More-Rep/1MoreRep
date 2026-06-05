'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { loginAction, magicLinkAction, type ActionState } from '@/server/actions/auth';
import { Btn } from '@/components/ui/Btn';
import { TextField, Alert, SubmitBtn } from './ui';

const initial: ActionState = {};

export function LoginForm() {
  const t = useTranslations('auth');
  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [pwState, pwAction] = useActionState(loginAction, initial);
  const [magicState, magicAction] = useActionState(magicLinkAction, initial);

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
    </div>
  );
}
