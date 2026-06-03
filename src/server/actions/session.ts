'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/server/db/prisma';
import { requireUser } from '@/lib/auth/guards';
import { currentSessionId, destroyOtherSessions, destroyAllSessions } from '@/lib/auth/session';
import { audit } from '@/lib/auth/audit';
import { getRequestContext } from '@/lib/request';

/** Revoke a single session — ownership-scoped so a user can only kill their own devices. */
export async function revokeSessionAction(sessionId: string): Promise<void> {
  const user = await requireUser();
  const ctx = await getRequestContext();
  await prisma.session.deleteMany({ where: { id: sessionId, userId: user.id } });
  await audit({ actorId: user.id, action: 'auth.session.revoke', targetType: 'session', targetId: sessionId, ip: ctx.ip });
  revalidatePath('/app/settings/sessions');
}

/** Log out of every other device, keeping the current session. */
export async function logoutOtherSessionsAction(): Promise<void> {
  const user = await requireUser();
  const ctx = await getRequestContext();
  const keepId = await currentSessionId();
  if (keepId) await destroyOtherSessions(user.id, keepId);
  else await destroyAllSessions(user.id);
  await audit({ actorId: user.id, action: 'auth.session.revoke_others', ip: ctx.ip });
  revalidatePath('/app/settings/sessions');
}
