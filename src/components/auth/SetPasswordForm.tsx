'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { changePasswordAction, type ActionState } from '@/server/actions/auth';
import { TextField, Alert, SubmitBtn } from './ui';

export function SetPasswordForm() {
  const t = useTranslations('auth');
  const [state, action] = useActionState(changePasswordAction, {} as ActionState);
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Alert kind="error">{state.error}</Alert>
      <TextField label={t('newPassword')} name="password" type="password" autoComplete="new-password" required minLength={10} />
      <SubmitBtn icon="check">{t('savePassword')}</SubmitBtn>
    </form>
  );
}
