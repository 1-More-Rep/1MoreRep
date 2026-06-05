'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { registerAction, type ActionState } from '@/server/actions/auth';
import { TextField, Alert, SubmitBtn } from './ui';

export function RegisterForm() {
  const t = useTranslations('auth');
  const [state, action] = useActionState(registerAction, {} as ActionState);
  if (state.ok) {
    return <Alert kind="notice">{state.notice}</Alert>;
  }
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Alert kind="error">{state.error}</Alert>
      <TextField label={t('displayName')} name="displayName" autoComplete="name" required />
      <TextField label={t('handle')} name="handle" placeholder={t('handlePlaceholder')} required />
      <TextField label={t('email')} name="email" type="email" autoComplete="email" required />
      <TextField label={t('password')} name="password" type="password" autoComplete="new-password" required />
      <SubmitBtn icon="arrowR">{t('createAccount')}</SubmitBtn>
    </form>
  );
}
