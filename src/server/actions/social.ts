'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth/guards';
import { sendFriendRequest, respondToRequest, removeFriend, blockUser, searchUsersByHandle } from '@/server/social/friends';
import { generateInviteLink, acceptInvite } from '@/server/social/inviteLink';
import { getPrivacy } from '@/server/social/privacy';
import { prisma } from '@/server/db/prisma';
import type { Visibility } from '@prisma/client';

export interface SocialState {
  error?: string;
  notice?: string;
}

export async function addFriendAction(_prev: SocialState, formData: FormData): Promise<SocialState> {
  const user = await requireUser();
  const handle = String(formData.get('handle') ?? '').trim();
  if (!handle) return { error: 'Enter a handle.' };
  const r = await sendFriendRequest(user.id, handle);
  if (r.error) return { error: r.error };
  revalidatePath('/app/social/friends');
  return { notice: 'Friend request sent.' };
}

export async function respondFriendAction(requesterId: string, accept: boolean): Promise<void> {
  const user = await requireUser();
  await respondToRequest(user.id, requesterId, accept);
  revalidatePath('/app/social/friends');
}

export async function removeFriendAction(otherId: string): Promise<void> {
  const user = await requireUser();
  await removeFriend(user.id, otherId);
  revalidatePath('/app/social/friends');
}

export async function searchUsersAction(q: string) {
  const user = await requireUser();
  return searchUsersByHandle(q, user.id);
}

/** Send a friend request to an exact handle (used by the typeahead result click). */
export async function sendRequestByHandleAction(handle: string): Promise<SocialState> {
  const user = await requireUser();
  const r = await sendFriendRequest(user.id, handle);
  if (r.error) return { error: r.error };
  revalidatePath('/app/social/friends');
  return { notice: 'Friend request sent.' };
}

export async function blockUserActionResult(targetId: string): Promise<SocialState> {
  const user = await requireUser();
  await blockUser(user.id, targetId);
  revalidatePath('/app/social/friends');
  return { notice: 'User blocked.' };
}

/** Mint a shareable invite link and return its app-relative join URL. */
export async function generateInviteLinkAction(): Promise<{ url: string }> {
  const user = await requireUser();
  const code = await generateInviteLink(user.id);
  return { url: `/app/social/join/${code}` };
}

/** Accept a shared invite link, becoming friends with its creator. */
export async function acceptInviteAction(code: string): Promise<SocialState> {
  const user = await requireUser();
  const r = await acceptInvite(code, user.id);
  if (r.error) return { error: r.error };
  revalidatePath('/app/social/friends');
  return { notice: 'You are now friends!' };
}

export async function updatePrivacyAction(_prev: SocialState, formData: FormData): Promise<SocialState> {
  const user = await requireUser();
  await getPrivacy(user.id); // ensure row
  const vis = (k: string): Visibility => {
    const v = String(formData.get(k));
    return v === 'PUBLIC' || v === 'FRIENDS' || v === 'PRIVATE' ? v : 'FRIENDS';
  };
  await prisma.privacySettings.update({
    where: { userId: user.id },
    data: {
      profileVisible: vis('profileVisible'),
      showWorkouts: vis('showWorkouts'),
      showStats: vis('showStats'),
      showPhotos: vis('showPhotos'),
      leaderboardOptIn: formData.get('leaderboardOptIn') === 'on',
      activityFeedOptIn: formData.get('activityFeedOptIn') === 'on',
      searchableByHandle: formData.get('searchableByHandle') === 'on',
    },
  });
  revalidatePath('/app/settings/privacy');
  return { notice: 'Privacy settings saved.' };
}
