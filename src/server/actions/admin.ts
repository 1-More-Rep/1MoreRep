'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { Role } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { requireRole } from '@/lib/auth/guards';
import { createSession, destroyAllSessions, destroyCurrentSession, validateSession } from '@/lib/auth/session';
import { canChangeRole, canDeactivate, canInvite, canEditSettings } from '@/lib/auth/adminPolicy';
import { issueToken } from '@/lib/auth/tokens';
import { sendMagicLink, verifySmtp } from '@/lib/mail';
import { updateSettings, encryptForStorage } from '@/lib/settings';
import { saveBrandLogo } from '@/server/services/brandService';
import { getConfiguredProvider } from '@/server/llm';
import { audit } from '@/lib/auth/audit';
import { getRequestContext } from '@/lib/request';
import { emailSchema } from '@/lib/validation/auth';

// Providers with a working adapter today. ANTHROPIC/OPENAI are stubbed (not yet
// implemented). Kept un-exported: a 'use server' file may only export async fns.
const SUPPORTED_LLM_PROVIDERS = ['NONE', 'OLLAMA'] as const;
const llmProviderSchema = z.enum(SUPPORTED_LLM_PROVIDERS);

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
  const providerParsed = llmProviderSchema.safeParse(String(formData.get('llmProvider') ?? 'NONE'));
  if (!providerParsed.success) {
    return { error: 'That LLM provider is not supported yet. Choose None or Ollama.' };
  }
  await updateSettings(
    {
      llmProvider: providerParsed.data,
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
  const actor = await requireRole('SUPERADMIN');
  const result = await verifySmtp(actor.email);
  if (!result.ok) return { error: result.error ?? 'SMTP test failed.' };
  return {
    ok: true,
    notice: result.sent ? `SMTP OK — a test email was sent to ${actor.email}.` : 'SMTP connection OK.',
  };
}

export async function testLlmAction(): Promise<AdminState> {
  await requireRole('SUPERADMIN');
  const provider = await getConfiguredProvider();
  if (!provider.isConfigured()) {
    return { error: 'No LLM provider is configured. Save a provider, base URL and model first.' };
  }
  try {
    const healthy = await provider.health();
    if (!healthy) return { error: `${provider.kind} provider is not reachable (health check failed).` };
    const res = await provider.complete({ system: 'You are a health check.', user: 'ping', maxTokens: 8 });
    const preview = res.text.trim().slice(0, 80);
    return { ok: true, notice: `${provider.kind} OK — replied: ${preview || '(empty response)'}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'LLM test failed.' };
  }
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export async function updateBrandingAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await requireRole('SUPERADMIN');
  const policy = canEditSettings(actor);
  if (!policy.ok) return { error: policy.reason };

  const themeColor = String(formData.get('themeColor') ?? '').trim();
  if (!HEX_COLOR.test(themeColor)) return { error: 'Enter a valid hex color (e.g. #e2553a).' };

  let brandLogoKey: string | undefined;
  const logo = formData.get('brandLogo');
  if (logo instanceof File && logo.size > 0) {
    const saved = await saveBrandLogo(Buffer.from(await logo.arrayBuffer()));
    if (!saved.ok) return { error: saved.error ?? 'Could not process the logo.' };
    brandLogoKey = saved.key;
  }

  await updateSettings(
    {
      themeColor,
      ...(brandLogoKey ? { brandLogoKey } : {}),
    },
    actor.id,
  );
  await audit({ actorId: actor.id, action: 'settings.branding.update', targetType: 'InstanceSettings' });
  revalidatePath('/admin/settings');
  revalidatePath('/', 'layout');
  return { ok: true, notice: brandLogoKey ? 'Branding saved (logo updated).' : 'Branding saved.' };
}

// ---- Impersonation (view-as another user) — ADMIN/SUPERADMIN ----

export async function impersonateUserAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await requireRole('ADMIN');
  const targetId = String(formData.get('targetId') ?? '');
  if (targetId === admin.id) return { error: 'You are already yourself.' };

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) return { error: 'User not found.' };
  if (target.status === 'DEACTIVATED') return { error: 'Cannot impersonate a deactivated user.' };
  // An admin may not impersonate a superadmin (no upward privilege escalation).
  if (target.role === 'SUPERADMIN' && admin.role !== 'SUPERADMIN') {
    return { error: 'Only a superadmin can impersonate a superadmin.' };
  }

  // Avoid nested impersonation: if we're already impersonating, refuse.
  const current = await validateSession();
  if (current?.impersonatorId) return { error: 'Stop the current impersonation first.' };

  const ctx = await getRequestContext();
  // Replace the admin's session with a fresh one for the target, stamped with the
  // real admin's id so it can be unwound and the banner can render.
  await destroyCurrentSession();
  await createSession(target.id, { ...ctx, impersonatorId: admin.id, label: 'impersonation' });
  await audit({ actorId: admin.id, action: 'user.impersonate.start', targetType: 'User', targetId, ip: ctx.ip });
  redirect('/app');
}

export async function stopImpersonatingAction(): Promise<AdminState> {
  const current = await validateSession();
  if (!current?.impersonatorId) return { error: 'Not currently impersonating.' };
  const impersonatorId = current.impersonatorId;
  const impersonatedId = current.user.id;

  const ctx = await getRequestContext();
  await destroyCurrentSession(); // end the impersonation session
  await createSession(impersonatorId, ctx); // re-establish the real admin's session
  await audit({ actorId: impersonatorId, action: 'user.impersonate.stop', targetType: 'User', targetId: impersonatedId, ip: ctx.ip });
  redirect('/admin/users');
}
