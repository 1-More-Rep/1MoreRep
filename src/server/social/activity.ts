import 'server-only';
import type { ActivityType, Prisma, Visibility } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { getPrivacy } from './privacy';
import { friendIds } from './friends';

export async function writeActivity(userId: string, type: ActivityType, meta: Prisma.InputJsonValue = {}, visibility: Visibility = 'FRIENDS'): Promise<void> {
  const privacy = await getPrivacy(userId);
  if (!privacy.activityFeedOptIn) return;
  await prisma.activityEvent.create({ data: { userId, type, meta, visibility } });
}

/** Friends' activity, privacy-filtered (blocked/private excluded). */
export async function getFeed(userId: string, limit = 40) {
  const ids = await friendIds(userId);
  if (ids.length === 0) return [];
  return prisma.activityEvent.findMany({
    where: { userId: { in: ids }, visibility: { in: ['PUBLIC', 'FRIENDS'] } },
    include: { user: { select: { displayName: true, publicHandle: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
