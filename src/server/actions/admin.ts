'use server';

import { revalidatePath } from 'next/cache';
import type { Role } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { requireRole } from '@/lib/auth/guards';
import { destroyAllSessions } from '@/lib/auth/session';
import { canChangeRole, canDeactivate, canInvite, canEditSettings } from '@/lib/auth/adminPolicy';
import { issueToken } from '@/lib/auth/tokens';
import { sendMagicLink, verifySmtp } from '@/lib/mail';
import { updateSettings, encryptForStorage } from '@/lib/settings';
import { audit } from '@/lib/auth/audit';
import { getRequestContext } from '@/lib/request';
import { emailSchema } from '@/lib/validation/auth';

export interface AdminState {
  error?: string;
  ok?: boolean;
  notice?: string;
}

async function activeSuperadminCount(): Promise<number> {
  return prisma.user.count({ where: { role: 'SUPERADMIN', status: { not: 'DEACTIVATED' } } });
}

/** Invite a user by email (sends an INVITE magic link). */
export async function inviteUserAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await requireRole('ADMIN');
  const emailParsed = emailSchema.safeParse(formData.get('email'));
  if (!emailParsed.success) return { error: 'Enter a valid email.' };
  const role = (String(formData.get('role') ?? 'USER') as Role) || 'USER';

  const policy = canInvite(actor, role);
  if (!policy.ok) return { error: policy.reason };

  const email = emailParsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: 'A user with that email already exists.' };

  const ctx = await getRequestContext();
  const user = await prisma.user.create({
    data: {
      email,
      displayName: email.split('@')[0] ?? 'New user',
      role,
      status: 'INVITED',
      invitedById: actor.id,
    },
  });
  const { url } = await issueToken('INVITE', user.id, { ip: ctx.ip });
  await sendMagicLink('INVITE', email, url);
  await audit({ actorId: actor.id, action: 'user.invite', targetType: 'User', targetId: user.id, ip: ctx.ip });
  revalidatePath('/admin/users');
  return { ok: true, notice: `Invitation sent to ${email}.` };
}

export async function setRoleAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await requireRole('ADMIN');
  const targetId = String(formData.get('targetId') ?? '');
  const newRole = String(formData.get('role') ?? '') as Role;
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) return { error: 'User not found.' };

  const policy = canChangeRole(actor, target, newRole, await activeSuperadminCount());
  if (!policy.ok) return { error: policy.reason };

  await prisma.user.update({ where: { id: targetId }, data: { role: newRole } });
  // Rotate sessions on privilege change (W1-T5) — force re-auth under the new role.
  await destroyAllSessions(targetId);
  await audit({ actorId: actor.id, action: 'user.role.change', targetType: 'User', targetId, metadata: { newRole } });
  revalidatePath('/admin/users');
  return { ok: true, notice: 'Role updated.' };
}

export async function toggleActiveAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await requireRole('ADMIN');
  const targetId = String(formData.get('targetId') ?? '');
  const activate = String(formData.get('activate') ?? '') === '1';
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) return { error: 'User not found.' };

  if (!activate) {
    const policy = canDeactivate(actor, target, await activeSuperadminCount());
    if (!policy.ok) return { error: policy.reason };
    await prisma.user.update({ where: { id: targetId }, data: { status: 'DEACTIVATED' } });
    await prisma.session.deleteMany({ where: { userId: targetId } }); // kill sessions
  } else {
    await prisma.user.update({ where: { id: targetId }, data: { status: 'ACTIVE' } });
  }
  await audit({ actorId: actor.id, action: activate ? 'user.activate' : 'user.deactivate', targetType: 'User', targetId });
  revalidatePath('/admin/users');
  return { ok: true, notice: activate ? 'User reactivated.' : 'User deactivated.' };
}

export async function resetUserAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await requireRole('ADMIN');
  const targetId = String(formData.get('targetId') ?? '');
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) return { error: 'User not found.' };
  if (target.role === 'SUPERADMIN' && actor.role !== 'SUPERADMIN') return { error: 'Only a superadmin can reset a superadmin.' };

  const { url } = await issueToken('PASSWORD_RESET', target.id);
  await sendMagicLink('PASSWORD_RESET', target.email, url);
  await audit({ actorId: actor.id, action: 'user.reset', targetType: 'User', targetId });
  return { ok: true, notice: `Reset link sent to ${target.email}.` };
}

// ---- Instance settings (superadmin only) ----

export async function updateGeneralSettingsAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await requireRole('SUPERADMIN');
  const policy = canEditSettings(actor);
  if (!policy.ok) return { error: policy.reason };

  await updateSettings(
    {
      brandName: String(formData.get('brandName') ?? '1MoreRep').slice(0, 60),
      defaultUnitSystem: String(formData.get('defaultUnitSystem')) === 'IMPERIAL' ? 'IMPERIAL' : 'METRIC',
      allowSelfRegistration: formData.get('allowSelfRegistration') === 'on',
      requireEmailVerification: formData.get('requireEmailVerification') === 'on',
    },
    actor.id,
  );
  await audit({ actorId: actor.id, action: 'settings.general.update', targetType: 'InstanceSettings' });
  revalidatePath('/admin/settings');
  return { ok: true, notice: 'Settings saved.' };
}

export async function updateSmtpAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await requireRole('SUPERADMIN');
  const host = String(formData.get('smtpHost') ?? '').trim();
  const password = String(formData.get('smtpPassword') ?? '');
  await updateSettings(
    {
      smtpHost: host || null,
      smtpPort: Number(formData.get('smtpPort')) || null,
      smtpUser: String(formData.get('smtpUser') ?? '').trim() || null,
      smtpFrom: String(formData.get('smtpFrom') ?? '').trim() || null,
      smtpSecure: formData.get('smtpSecure') === 'on',
      ...(password ? { smtpPasswordEnc: encryptForStorage(password) } : {}),
    },
    actor.id,
  );
  await audit({ actorId: actor.id, action: 'settings.smtp.update', targetType: 'InstanceSettings' });
  revalidatePath('/admin/settings');
  return { ok: true, notice: 'SMTP settings saved.' };
}

export async function updateLlmAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await requireRole('SUPERADMIN');
  const apiKey = String(formData.get('llmApiKey') ?? '');
  await updateSettings(
    {
      llmProvider: String(formData.get('llmProvider') ?? 'NONE'),
      llmBaseUrl: String(formData.get('llmBaseUrl') ?? '').trim() || null,
      llmModel: String(formData.get('llmModel') ?? '').trim() || null,
      ...(apiKey ? { llmApiKeyEnc: encryptForStorage(apiKey) } : {}),
    },
    actor.id,
  );
  await audit({ actorId: actor.id, action: 'settings.llm.update', targetType: 'InstanceSettings' });
  revalidatePath('/admin/settings');
  return { ok: true, notice: 'LLM settings saved.' };
}

export async function testSmtpAction(): Promise<AdminState> {
  await requireRole('SUPERADMIN');
  const result = await verifySmtp();
  return result.ok ? { ok: true, notice: 'SMTP connection OK.' } : { error: result.error ?? 'SMTP test failed.' };
}
