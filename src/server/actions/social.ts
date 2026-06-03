'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth/guards';
import { sendFriendRequest, respondToRequest, removeFriend, blockUser, searchUsersByHandle } from '@/server/social/friends';
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

export async function blockUserAction(targetId: string): Promise<void> {
  const user = await requireUser();
  await blockUser(user.id, targetId);
  revalidatePath('/app/social/friends');
}

export async function searchUsersAction(q: string) {
  const user = await requireUser();
  return searchUsersByHandle(q, user.id);
}

export async function updatePrivacyAction(_prev: SocialState, formData: FormData): Promise<SocialState> {
  const user = await requireUser();
  await getPrivacy(user.id); // ensure row
  await prisma.privacySettings.update({
    where: { userId: user.id },
    data: {
      profileVisible: (String(formData.get('profileVisible')) as Visibility) || 'FRIENDS',
      leaderboardOptIn: formData.get('leaderboardOptIn') === 'on',
      activityFeedOptIn: formData.get('activityFeedOptIn') === 'on',
      searchableByHandle: formData.get('searchableByHandle') === 'on',
    },
  });
  revalidatePath('/app/settings/privacy');
  return { notice: 'Privacy settings saved.' };
}
