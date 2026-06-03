'use client';

import { useActionState } from 'react';
import { addFriendAction, removeFriendAction, type SocialState } from '@/server/actions/social';
import { Btn } from '@/components/ui/Btn';
import { Chip } from '@/components/ui/Chip';
import { useTransition } from 'react';

export function ProfileFriendButton({ handle, userId, status }: { handle: string; userId: string; status: string }) {
  const [state, action] = useActionState(addFriendAction, {} as SocialState);
  const [, start] = useTransition();

  if (status === 'ACCEPTED') {
    return <Btn kind="ghost" size="sm" onClick={() => start(() => removeFriendAction(userId))}>Friends ✓</Btn>;
  }
  if (status === 'PENDING') return <Chip>Requested</Chip>;
  if (state.notice) return <Chip accent>{state.notice}</Chip>;
  return (
    <form action={action}>
      <input type="hidden" name="handle" value={handle} />
      <Btn type="submit" size="sm" icon="plus">Add friend</Btn>
    </form>
  );
}
