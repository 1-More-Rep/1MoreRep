'use client';

import { useActionState, useState } from 'react';
import { loginAction, magicLinkAction, type ActionState } from '@/server/actions/auth';
import { Btn } from '@/components/ui/Btn';
import { TextField, Alert, SubmitBtn } from './ui';

const initial: ActionState = {};

export function LoginForm() {
  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [pwState, pwAction] = useActionState(loginAction, initial);
  const [magicState, magicAction] = useActionState(magicLinkAction, initial);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {mode === 'password' ? (
        <form action={pwAction} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Alert kind="error">{pwState.error}</Alert>
          <TextField label="Email" name="email" type="email" autoComplete="email" required />
          <TextField label="Password" name="password" type="password" autoComplete="current-password" required />
          <SubmitBtn icon="arrowR">Sign in</SubmitBtn>
        </form>
      ) : (
        <form action={magicAction} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Alert kind="error">{magicState.error}</Alert>
          <Alert kind="notice">{magicState.notice}</Alert>
          {!magicState.ok && (
            <>
              <TextField label="Email" name="email" type="email" autoComplete="email" required />
              <SubmitBtn icon="arrowR">Email me a sign-in link</SubmitBtn>
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
        {mode === 'password' ? 'Use a magic link instead' : 'Use a password instead'}
      </Btn>
    </div>
  );
}
