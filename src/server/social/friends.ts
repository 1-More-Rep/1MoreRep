import 'server-only';
import type { FriendStatus } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { AuthorizationError } from '@/lib/auth/guards';

/** Public-safe user projection — never exposes email or internal-only fields. */
const publicUserSelect = { id: true, displayName: true, publicHandle: true, avatarKey: true } as const;

export async function areBlocked(a: string, b: string): Promise<boolean> {
  const block = await prisma.block.findFirst({
    where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
  });
  return !!block;
}

export async function friendshipStatus(viewerId: string, otherId: string): Promise<FriendStatus | 'NONE' | 'SELF'> {
  if (viewerId === otherId) return 'SELF';
  const f = await prisma.friendship.findFirst({
    where: { OR: [{ requesterId: viewerId, addresseeId: otherId }, { requesterId: otherId, addresseeId: viewerId }] },
  });
  return f?.status ?? 'NONE';
}

export async function areFriends(a: string, b: string): Promise<boolean> {
  return (await friendshipStatus(a, b)) === 'ACCEPTED';
}

export async function searchUsersByHandle(q: string, viewerId: string) {
  if (q.trim().length < 2) return [];
  return prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      id: { not: viewerId },
      publicHandle: { contains: q.trim(), mode: 'insensitive' },
      OR: [{ privacy: { is: null } }, { privacy: { searchableByHandle: true } }],
      NOT: { OR: [{ blocksMade: { some: { blockedId: viewerId } } }, { blocksReceived: { some: { blockerId: viewerId } } }] },
    },
    select: publicUserSelect,
    take: 15,
  });
}

export async function sendFriendRequest(requesterId: string, handle: string): Promise<{ error?: string; ok?: boolean }> {
  const target = await prisma.user.findUnique({ where: { publicHandle: handle }, select: { id: true } });
  if (!target) return { error: 'No user with that handle.' };
  if (target.id === requesterId) return { error: "You can't add yourself." };
  if (await areBlocked(requesterId, target.id)) return { error: 'Unable to send request.' };

  const existing = await friendshipStatus(requesterId, target.id);
  if (existing === 'ACCEPTED') return { error: 'Already friends.' };
  if (existing === 'PENDING') return { error: 'Request already pending.' };

  await prisma.friendship.upsert({
    where: { requesterId_addresseeId: { requesterId, addresseeId: target.id } },
    update: { status: 'PENDING', respondedAt: null },
    create: { requesterId, addresseeId: target.id, status: 'PENDING' },
  });
  await prisma.notification.create({ data: { userId: target.id, kind: 'FRIEND_REQUEST', title: 'New friend request', body: 'Someone wants to connect.' } });
  return { ok: true };
}

export async function respondToRequest(userId: string, requesterId: string, accept: boolean): Promise<void> {
  const req = await prisma.friendship.findUnique({ where: { requesterId_addresseeId: { requesterId, addresseeId: userId } } });
  if (!req || req.addresseeId !== userId) throw new AuthorizationError();
  await prisma.friendship.update({
    where: { id: req.id },
    data: { status: accept ? 'ACCEPTED' : 'DECLINED', respondedAt: new Date() },
  });
}

export async function removeFriend(userId: string, otherId: string): Promise<void> {
  await prisma.friendship.deleteMany({
    where: { OR: [{ requesterId: userId, addresseeId: otherId }, { requesterId: otherId, addresseeId: userId }] },
  });
}

export async function blockUser(userId: string, targetId: string): Promise<void> {
  if (userId === targetId) return;
  await prisma.$transaction([
    prisma.friendship.deleteMany({ where: { OR: [{ requesterId: userId, addresseeId: targetId }, { requesterId: targetId, addresseeId: userId }] } }),
    prisma.block.upsert({ where: { blockerId_blockedId: { blockerId: userId, blockedId: targetId } }, update: {}, create: { blockerId: userId, blockedId: targetId } }),
  ]);
}

export async function listFriends(userId: string) {
  const rows = await prisma.friendship.findMany({
    where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] },
    include: { requester: { select: publicUserSelect }, addressee: { select: publicUserSelect } },
    orderBy: { respondedAt: 'desc' },
  });
  return rows.map((f) => (f.requesterId === userId ? f.addressee : f.requester));
}

export async function listPendingRequests(userId: string) {
  const rows = await prisma.friendship.findMany({
    where: { status: 'PENDING', addresseeId: userId },
    include: { requester: { select: publicUserSelect } },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((f) => f.requester);
}

/** Accepted-friend user ids (for activity-feed + leaderboard scoping). */
export async function friendIds(userId: string): Promise<string[]> {
  const rows = await prisma.friendship.findMany({
    where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] },
    select: { requesterId: true, addresseeId: true },
  });
  return rows.map((f) => (f.requesterId === userId ? f.addresseeId : f.requesterId));
}
