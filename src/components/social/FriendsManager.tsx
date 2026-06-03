'use client';

import { useActionState, useTransition } from 'react';
import Link from 'next/link';
import { addFriendAction, respondFriendAction, removeFriendAction, type SocialState } from '@/server/actions/social';
import { Card } from '@/components/ui/Card';
import { Btn } from '@/components/ui/Btn';
import { Chip } from '@/components/ui/Chip';
import { Icon, Mono, SectionLabel } from '@/components/ui';
import { Alert, TextField } from '@/components/auth/ui';

export interface FriendLite {
  id: string;
  displayName: string;
  publicHandle: string | null;
  streak?: number;
}

export function FriendsManager({ friends, requests }: { friends: FriendLite[]; requests: FriendLite[] }) {
  const [state, action] = useActionState(addFriendAction, {} as SocialState);
  const [, start] = useTransition();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <Card>
        <SectionLabel style={{ marginBottom: 12 }}>Add a friend</SectionLabel>
        <form action={action} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <Alert kind="error">{state.error}</Alert>
            <Alert kind="notice">{state.notice}</Alert>
            <TextField label="Handle" name="handle" placeholder="their @handle" />
          </div>
          <Btn type="submit" icon="plus">Send request</Btn>
        </form>
      </Card>

      {requests.length > 0 && (
        <Card pad={false}>
          <div style={{ padding: 'var(--pad) var(--pad) 0' }}><SectionLabel>Requests</SectionLabel></div>
          {requests.map((r, i) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'var(--row) var(--pad)', borderTop: i ? '1px solid var(--line)' : '1px solid var(--line)', marginTop: i ? 0 : 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>{r.displayName}</div>
                {r.publicHandle && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>@{r.publicHandle}</div>}
              </div>
              <Btn kind="primary" size="sm" onClick={() => start(() => respondFriendAction(r.id, true))}>Accept</Btn>
              <Btn kind="ghost" size="sm" onClick={() => start(() => respondFriendAction(r.id, false))}>Decline</Btn>
            </div>
          ))}
        </Card>
      )}

      <SectionLabel>Friends ({friends.length})</SectionLabel>
      {friends.length === 0 && <Card soft><span style={{ color: 'var(--text-3)' }}>No friends yet — add someone by their handle.</span></Card>}
      {friends.map((f) => (
        <Card key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href={f.publicHandle ? `/app/u/${f.publicHandle}` : '#'} style={{ flex: 1, textDecoration: 'none', color: 'inherit' }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{f.displayName}</div>
            {f.publicHandle && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>@{f.publicHandle}</div>}
          </Link>
          {f.streak ? (
            <Chip accent><Icon name="flame" size={13} stroke={2} /><Mono>{f.streak}</Mono></Chip>
          ) : null}
          <Btn kind="ghost" size="sm" onClick={() => start(() => removeFriendAction(f.id))}>Remove</Btn>
        </Card>
      ))}
    </div>
  );
}
