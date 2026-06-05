'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { resetRequestAction, type ActionState } from '@/server/actions/auth';
import { TextField, Alert, SubmitBtn } from './ui';

export function ResetForm() {
  const t = useTranslations('auth');
  const [state, action] = useActionState(resetRequestAction, {} as ActionState);
  if (state.ok) return <Alert kind="notice">{state.notice}</Alert>;
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Alert kind="error">{state.error}</Alert>
      <TextField label={t('email')} name="email" type="email" autoComplete="email" required />
      <SubmitBtn icon="arrowR">{t('sendResetLink')}</SubmitBtn>
    </form>
  );
}
