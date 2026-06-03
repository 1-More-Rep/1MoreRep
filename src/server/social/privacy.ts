import 'server-only';
import type { PrivacySettings, Visibility } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { areBlocked, areFriends } from './friends';

export async function getPrivacy(userId: string): Promise<PrivacySettings> {
  return prisma.privacySettings.upsert({ where: { userId }, update: {}, create: { userId } });
}

/** Whether `viewer` may see content with the given `visibility` owned by `target`. */
export async function canView(viewerId: string, targetId: string, visibility: Visibility): Promise<boolean> {
  if (viewerId === targetId) return true;
  if (await areBlocked(viewerId, targetId)) return false;
  if (visibility === 'PUBLIC') return true;
  if (visibility === 'PRIVATE') return false;
  return areFriends(viewerId, targetId); // FRIENDS
}
