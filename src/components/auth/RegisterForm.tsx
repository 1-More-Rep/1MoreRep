'use client';

import { useActionState } from 'react';
import { registerAction, type ActionState } from '@/server/actions/auth';
import { TextField, Alert, SubmitBtn } from './ui';

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, {} as ActionState);
  if (state.ok) {
    return <Alert kind="notice">{state.notice}</Alert>;
  }
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Alert kind="error">{state.error}</Alert>
      <TextField label="Display name" name="displayName" autoComplete="name" required />
      <TextField label="Handle" name="handle" placeholder="lowercase, no spaces" required />
      <TextField label="Email" name="email" type="email" autoComplete="email" required />
      <TextField label="Password" name="password" type="password" autoComplete="new-password" required />
      <SubmitBtn icon="arrowR">Create account</SubmitBtn>
    </form>
  );
}
