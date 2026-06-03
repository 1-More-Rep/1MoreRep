'use server';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { requireUser } from '@/lib/auth/guards';

/** Persist the user's theme tweaks to their account so they follow across devices. */
export async function saveAppearanceAction(tweaks: Record<string, unknown>): Promise<void> {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { appearance: tweaks as Prisma.InputJsonValue } });
}
