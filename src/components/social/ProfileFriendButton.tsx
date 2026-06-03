'use client';

import { useActionState, useState, useTransition } from 'react';
import { addFriendAction, removeFriendAction, blockUserActionResult, type SocialState } from '@/server/actions/social';
import { Btn } from '@/components/ui/Btn';
import { Chip } from '@/components/ui/Chip';

export function ProfileFriendButton({ handle, userId, status }: { handle: string; userId: string; status: string }) {
  const [state, action] = useActionState(addFriendAction, {} as SocialState);
  const [, start] = useTransition();
  const [blocked, setBlocked] = useState(false);

  function block() {
    if (!window.confirm(`Block @${handle}? They'll be removed as a friend and hidden from search.`)) return;
    start(async () => {
      await blockUserActionResult(userId);
      setBlocked(true);
    });
  }

  if (blocked) return <Chip>Blocked</Chip>;

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {status === 'ACCEPTED' ? (
        <Btn kind="ghost" size="sm" onClick={() => start(() => removeFriendAction(userId))}>Friends ✓</Btn>
      ) : status === 'PENDING' ? (
        <Chip>Requested</Chip>
      ) : state.notice ? (
        <Chip accent>{state.notice}</Chip>
      ) : (
        <form action={action}>
          <input type="hidden" name="handle" value={handle} />
          <Btn type="submit" size="sm" icon="plus">Add friend</Btn>
        </form>
      )}
      <Btn kind="ghost" size="sm" onClick={block} style={{ color: 'var(--text-3)' }}>Block</Btn>
    </div>
  );
}
