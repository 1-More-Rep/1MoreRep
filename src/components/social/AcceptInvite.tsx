'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { acceptInviteAction } from '@/server/actions/social';
import { Btn, Icon } from '@/components/ui';
import { Alert } from '@/components/auth/ui';

/**
 * Explicit confirm-then-accept for an invite link. Accepting is a state change, so
 * it must be a deliberate POST (button), never a side effect of loading the page —
 * a link prefetch or accidental visit must not silently create a friendship.
 */
export function AcceptInvite({ code, inviterName }: { code: string; inviterName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ error?: string; ok?: boolean } | null>(null);

  function accept() {
    start(async () => {
      const r = await acceptInviteAction(code);
      setResult(r);
    });
  }

  if (result?.ok) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
        <span
          style={{
            width: 48,
            height: 48,
            borderRadius: 'var(--r-pill)',
            background: 'var(--accent-soft)',
            color: 'var(--accent-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="check" size={24} stroke={2} />
        </span>
        <div style={{ fontSize: 16, fontWeight: 600 }}>You and {inviterName} are now friends!</div>
        <Btn href="/app/profile/friends" icon="users">Go to friends</Btn>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
      <span
        style={{
          width: 48,
          height: 48,
          borderRadius: 'var(--r-pill)',
          background: 'var(--surface-2)',
          color: 'var(--accent-text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="users" size={24} stroke={2} />
      </span>
      <div style={{ fontSize: 16, fontWeight: 600 }}>
        <strong>{inviterName}</strong> invited you to connect on 1MoreRep.
      </div>
      {result?.error && <Alert kind="error">{result.error}</Alert>}
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn icon="check" onClick={accept} disabled={pending}>
          {pending ? 'Accepting…' : 'Accept invite'}
        </Btn>
        <Btn kind="ghost" onClick={() => router.push('/app')}>Not now</Btn>
      </div>
    </div>
  );
}
