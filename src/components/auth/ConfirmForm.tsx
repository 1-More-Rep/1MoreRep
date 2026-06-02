'use client';

import { useActionState } from 'react';
import { callbackConfirmAction, type ActionState } from '@/server/actions/auth';
import { Alert, SubmitBtn } from './ui';

const LABEL: Record<string, string> = {
  LOGIN_LINK: 'Sign in',
  INVITE: 'Accept invite',
  EMAIL_VERIFY: 'Verify email',
  PASSWORD_RESET: 'Continue',
  EMAIL_CHANGE: 'Confirm new email',
};

export function ConfirmForm({ type, token }: { type: string; token: string }) {
  const [state, action] = useActionState(callbackConfirmAction, {} as ActionState);
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Alert kind="error">{state.error}</Alert>
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="token" value={token} />
      <SubmitBtn icon="check">{LABEL[type] ?? 'Continue'}</SubmitBtn>
    </form>
  );
}
