'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { callbackConfirmAction, type ActionState } from '@/server/actions/auth';
import { Alert, SubmitBtn } from './ui';

const LABEL_KEY: Record<string, string> = {
  LOGIN_LINK: 'confirmSignIn',
  INVITE: 'confirmAcceptInvite',
  EMAIL_VERIFY: 'confirmVerifyEmail',
  PASSWORD_RESET: 'confirmContinue',
  EMAIL_CHANGE: 'confirmNewEmail',
};

export function ConfirmForm({ type, token }: { type: string; token: string }) {
  const t = useTranslations('auth');
  const [state, action] = useActionState(callbackConfirmAction, {} as ActionState);
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Alert kind="error">{state.error}</Alert>
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="token" value={token} />
      <SubmitBtn icon="check">{t(LABEL_KEY[type] ?? 'confirmContinue')}</SubmitBtn>
    </form>
  );
}
