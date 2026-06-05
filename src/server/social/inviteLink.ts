import 'server-only';
import { prisma } from '@/server/db/prisma';
import { randomToken } from '@/lib/crypto';
import { areBlocked } from './friends';

interface GenerateOpts {
  expiresAt?: Date;
  maxUses?: number;
}

/** Create a shareable invite link for `creatorId`, returning its URL-safe code. */
export async function generateInviteLink(creatorId: string, opts: GenerateOpts = {}): Promise<string> {
  const code = randomToken(16);
  await prisma.inviteLink.create({
    data: { code, creatorId, expiresAt: opts.expiresAt ?? null, maxUses: opts.maxUses ?? null },
  });
  return code;
}

/**
 * Read-only look at an invite: who created it and whether it's still usable, WITHOUT
 * accepting it. Lets the join page show a confirm step instead of auto-befriending on
 * a bare GET (which a link prefetch or accidental visit could otherwise trigger).
 */
export async function peekInvite(
  code: string,
  viewerId: string,
): Promise<{ error?: string; creator?: { displayName: string; publicHandle: string | null }; self?: boolean }> {
  const invite = await prisma.inviteLink.findUnique({
    where: { code },
    include: { creator: { select: { displayName: true, publicHandle: true } } },
  });
  if (!invite) return { error: 'This invite link is invalid.' };
  if (invite.expiresAt && invite.expiresAt < new Date()) return { error: 'This invite link has expired.' };
  if (invite.maxUses != null && invite.useCount >= invite.maxUses) return { error: 'This invite link has been used up.' };
  if (invite.creatorId === viewerId) return { self: true, creator: invite.creator };
  return { creator: invite.creator };
}

/** Accept an invite link: becomes friends with the creator. Idempotent and validated. */
export async function acceptInvite(code: string, accepterId: string): Promise<{ error?: string; ok?: boolean }> {
  const invite = await prisma.inviteLink.findUnique({ where: { code } });
  if (!invite) return { error: 'This invite link is invalid.' };
  if (invite.expiresAt && invite.expiresAt < new Date()) return { error: 'This invite link has expired.' };
  if (invite.maxUses != null && invite.useCount >= invite.maxUses) return { error: 'This invite link has been used up.' };
  if (invite.creatorId === accepterId) return { error: "You can't accept your own invite." };
  if (await areBlocked(invite.creatorId, accepterId)) return { error: 'Unable to accept this invite.' };

  // A friendship may already exist in either direction (e.g. a pending request the
  // accepter sent). Collapse it to a single ACCEPTED row keyed creator→accepter.
  const reverse = await prisma.friendship.findUnique({
    where: { requesterId_addresseeId: { requesterId: accepterId, addresseeId: invite.creatorId } },
  });

  await prisma.$transaction([
    ...(reverse ? [prisma.friendship.delete({ where: { id: reverse.id } })] : []),
    prisma.friendship.upsert({
      where: { requesterId_addresseeId: { requesterId: invite.creatorId, addresseeId: accepterId } },
      update: { status: 'ACCEPTED', respondedAt: new Date() },
      create: { requesterId: invite.creatorId, addresseeId: accepterId, status: 'ACCEPTED', respondedAt: new Date() },
    }),
    prisma.inviteLink.update({ where: { id: invite.id }, data: { useCount: { increment: 1 } } }),
  ]);
  return { ok: true };
}
