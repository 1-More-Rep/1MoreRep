'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { Prisma, type Role } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { requireRole } from '@/lib/auth/guards';
import { createSession, destroyAllSessions, destroyCurrentSession, validateSession } from '@/lib/auth/session';
import { canChangeRole, canDeactivate, canReactivate, canInvite, canEditSettings } from '@/lib/auth/adminPolicy';
import { issueToken } from '@/lib/auth/tokens';
import { sendMagicLink, verifySmtp } from '@/lib/mail';
import { updateSettings, encryptForStorage } from '@/lib/settings';
import { saveBrandLogo } from '@/server/services/brandService';
import { getConfiguredProvider } from '@/server/llm';
import { fetchOllamaModels } from '@/server/llm/ollama';
import { audit } from '@/lib/auth/audit';
import { getRequestContext } from '@/lib/request';
import { emailSchema } from '@/lib/validation/auth';
import { logger } from '@/lib/logger';

// Providers with a working adapter today. ANTHROPIC/OPENAI are stubbed (not yet
// implemented). Kept un-exported: a 'use server' file may only export async fns.
const SUPPORTED_LLM_PROVIDERS = ['NONE', 'OLLAMA'] as const;
const llmProviderSchema = z.enum(SUPPORTED_LLM_PROVIDERS);

const ROLE_VALUES = ['USER', 'ADMIN', 'SUPERADMIN'] as const;
/** Parse a raw FormData value into a Role, or null if it is not a valid Role. */
function parseRole(value: FormDataEntryValue | null): Role | null {
  const s = String(value ?? '');
  return (ROLE_VALUES as readonly string[]).includes(s) ? (s as Role) : null;
}

/** True if `u` parses as an http: or https: URL. */
function isHttpUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface AdminState {
  error?: string;
  ok?: boolean;
  notice?: string;
  /** Populated by probeLlmAction: model names discovered on the LLM server. */
  models?: string[];
}

async function activeSuperadminCount(tx: Prisma.TransactionClient = prisma): Promise<number> {
  // Only ACTIVE superadmins can actually sign in and administer the instance. Counting
  // INVITED ones (who have never accepted their invite and cannot authenticate) would let
  // the last-superadmin guard be satisfied by a phantom, allowing the only usable
  // superadmin to be deactivated/demoted — locking the instance out of superadmin access.
  return tx.user.count({ where: { role: 'SUPERADMIN', status: 'ACTIVE' } });
}

function isWriteConflict(e: unknown): boolean {
  // P2034: transaction failed due to a write conflict / deadlock under SERIALIZABLE.
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034';
}

/** Invite a user by email (sends an INVITE magic link). */
export async function inviteUserAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await requireRole('ADMIN');
  const t = await getTranslations('adminErr');
  const emailParsed = emailSchema.safeParse(formData.get('email'));
  if (!emailParsed.success) return { error: t('invalidEmail') };
  const role = parseRole(formData.get('role'));
  if (!role) return { error: t('invalidRole') };

  const policy = canInvite(actor, role);
  if (!policy.ok) return { error: t(policy.code!) };

  const email = emailParsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: t('emailExists') };

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
  await audit({ actorId: actor.id, action: 'user.invite', targetType: 'User', targetId: user.id, ip: ctx.ip });
  revalidatePath('/admin/users');
  // The user + token already exist; if the email fails, say so clearly instead of throwing a
  // raw error that leaves the admin unsure whether the invite was created at all.
  try {
    await sendMagicLink('INVITE', email, url);
  } catch (err) {
    logger.error({ err, email }, '[admin] invite email failed to send');
    return { ok: true, notice: t('inviteCreatedEmailFailed') };
  }
  return { ok: true, notice: t('invitationSent', { email }) };
}

export async function setRoleAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await requireRole('ADMIN');
  const t = await getTranslations('adminErr');
  const targetId = String(formData.get('targetId') ?? '');
  const newRole = parseRole(formData.get('role'));
  if (!newRole) return { error: t('invalidRole') };

  // The last-superadmin guard reads a count and then writes — do both inside one
  // SERIALIZABLE transaction so two admins concurrently demoting the last two
  // superadmins can't each pass the check and leave the instance with zero (TOCTOU).
  let outcome: { ok: true } | { error: string };
  try {
    outcome = await prisma.$transaction(
      async (tx) => {
        const target = await tx.user.findUnique({ where: { id: targetId } });
        if (!target) return { error: t('userNotFound') };
        const policy = canChangeRole(actor, target, newRole, await activeSuperadminCount(tx));
        if (!policy.ok) return { error: t(policy.code ?? 'operationNotPermitted') };
        await tx.user.update({ where: { id: targetId }, data: { role: newRole } });
        return { ok: true as const };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (e) {
    if (isWriteConflict(e)) return { error: t('retryConflict') };
    throw e;
  }
  if ('error' in outcome) return { error: outcome.error };

  // Rotate sessions on privilege change (W1-T5) — force re-auth under the new role.
  await destroyAllSessions(targetId);
  await audit({ actorId: actor.id, action: 'user.role.change', targetType: 'User', targetId, metadata: { newRole } });
  revalidatePath('/admin/users');
  return { ok: true, notice: t('roleUpdated') };
}

export async function toggleActiveAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await requireRole('ADMIN');
  const t = await getTranslations('adminErr');
  const targetId = String(formData.get('targetId') ?? '');
  const activate = String(formData.get('activate') ?? '') === '1';

  if (!activate) {
    // Same TOCTOU concern as setRoleAction: count-then-deactivate must be atomic so the
    // last active superadmin can't be deactivated by two racing requests.
    let outcome: { ok: true } | { error: string };
    try {
      outcome = await prisma.$transaction(
        async (tx) => {
          const target = await tx.user.findUnique({ where: { id: targetId } });
          if (!target) return { error: t('userNotFound') };
          const policy = canDeactivate(actor, target, await activeSuperadminCount(tx));
          if (!policy.ok) return { error: t(policy.code ?? 'operationNotPermitted') };
          await tx.user.update({ where: { id: targetId }, data: { status: 'DEACTIVATED' } });
          await tx.session.deleteMany({ where: { userId: targetId } }); // kill sessions
          return { ok: true as const };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (e) {
      if (isWriteConflict(e)) return { error: t('retryConflict') };
      throw e;
    }
    if ('error' in outcome) return { error: outcome.error };
  } else {
    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) return { error: t('userNotFound') };
    // Reactivation needs the same role gate as deactivation — an admin must not be
    // able to reactivate a superadmin a superadmin had disabled.
    const policy = canReactivate(actor, target);
    if (!policy.ok) return { error: t(policy.code!) };
    await prisma.user.update({ where: { id: targetId }, data: { status: 'ACTIVE' } });
  }
  await audit({ actorId: actor.id, action: activate ? 'user.activate' : 'user.deactivate', targetType: 'User', targetId });
  revalidatePath('/admin/users');
  return { ok: true, notice: activate ? t('userReactivated') : t('userDeactivated') };
}

export async function resetUserAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await requireRole('ADMIN');
  const t = await getTranslations('adminErr');
  const targetId = String(formData.get('targetId') ?? '');
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) return { error: t('userNotFound') };
  if (target.role === 'SUPERADMIN' && actor.role !== 'SUPERADMIN') return { error: t('superadminOnlyReset') };

  const { url } = await issueToken('PASSWORD_RESET', target.id);
  await audit({ actorId: actor.id, action: 'user.reset', targetType: 'User', targetId });
  try {
    await sendMagicLink('PASSWORD_RESET', target.email, url);
  } catch (err) {
    logger.error({ err, email: target.email }, '[admin] reset email failed to send');
    return { error: t('resetEmailFailed') };
  }
  return { ok: true, notice: t('resetLinkSent', { email: target.email }) };
}

// ---- Instance settings (superadmin only) ----

export async function updateGeneralSettingsAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await requireRole('SUPERADMIN');
  const t = await getTranslations('adminErr');
  const policy = canEditSettings(actor);
  if (!policy.ok) return { error: t(policy.code!) };

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
  return { ok: true, notice: t('settingsSaved') };
}

export async function updateSmtpAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await requireRole('SUPERADMIN');
  const t = await getTranslations('adminErr');
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
  return { ok: true, notice: t('smtpSaved') };
}

export async function updateLlmAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await requireRole('SUPERADMIN');
  const t = await getTranslations('adminErr');
  const apiKey = String(formData.get('llmApiKey') ?? '');
  const providerParsed = llmProviderSchema.safeParse(String(formData.get('llmProvider') ?? 'NONE'));
  if (!providerParsed.success) {
    return { error: t('llmProviderUnsupported') };
  }
  const llmBaseUrl = String(formData.get('llmBaseUrl') ?? '').trim() || null;
  // SSRF hardening: the base URL is later fetch()'d server-side. We can't block private
  // hosts (a self-hosted Ollama legitimately lives on localhost/a private network), but
  // we restrict the scheme to http(s) so other protocols can't be smuggled in.
  if (llmBaseUrl && !isHttpUrl(llmBaseUrl)) {
    return { error: t('llmUrlInvalid') };
  }
  await updateSettings(
    {
      llmProvider: providerParsed.data,
      llmBaseUrl,
      llmModel: String(formData.get('llmModel') ?? '').trim() || null,
      ...(apiKey ? { llmApiKeyEnc: encryptForStorage(apiKey) } : {}),
    },
    actor.id,
  );
  await audit({ actorId: actor.id, action: 'settings.llm.update', targetType: 'InstanceSettings' });
  revalidatePath('/admin/settings');
  return { ok: true, notice: t('llmSaved') };
}

export async function testSmtpAction(): Promise<AdminState> {
  const actor = await requireRole('SUPERADMIN');
  const t = await getTranslations('adminErr');
  const result = await verifySmtp(actor.email, actor.locale);
  if (!result.ok) return { error: result.error ?? t('smtpTestFailed') };
  return {
    ok: true,
    notice: result.sent ? t('smtpTestSent', { email: actor.email }) : t('smtpTestOk'),
  };
}

export async function testLlmAction(): Promise<AdminState> {
  await requireRole('SUPERADMIN');
  const t = await getTranslations('adminErr');
  const provider = await getConfiguredProvider();
  if (!provider.isConfigured()) {
    return { error: t('llmNotConfigured') };
  }
  try {
    const healthy = await provider.health();
    if (!healthy) return { error: t('llmUnreachable', { provider: provider.kind }) };
    const res = await provider.complete({ system: 'You are a health check.', user: 'ping', maxTokens: 8 });
    const preview = res.text.trim().slice(0, 80);
    return { ok: true, notice: t('llmTestOk', { provider: provider.kind, preview: preview || '(empty response)' }) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : t('llmTestFailed') };
  }
}

/**
 * Lightweight "Check connection" for the LLM admin form. Probes the UNSAVED form
 * values (so you can test before saving) and, for Ollama, returns the list of
 * installed models to populate the model dropdown. SSRF posture matches
 * updateLlmAction: superadmin-only, http(s)-scheme-only, short timeout. Private/
 * localhost hosts are intentionally allowed (self-hosted Ollama lives there).
 */
export async function probeLlmAction(formData: FormData): Promise<AdminState> {
  await requireRole('SUPERADMIN');
  const t = await getTranslations('adminErr');
  const provider = String(formData.get('llmProvider') ?? 'NONE');
  const baseUrl = String(formData.get('llmBaseUrl') ?? '').trim();

  if (provider === 'OLLAMA') {
    if (!baseUrl) return { error: t('enterOllamaUrl') };
    if (!isHttpUrl(baseUrl)) return { error: t('urlInvalid') };
    try {
      const models = await fetchOllamaModels(baseUrl, 2500);
      if (models.length === 0) {
        return { ok: true, notice: t('ollamaNoModels'), models: [] };
      }
      return { ok: true, notice: t('ollamaModelsFound', { count: models.length }), models };
    } catch (e) {
      return { error: e instanceof Error ? e.message : t('ollamaUnreachable') };
    }
  }

  if (provider === 'ANTHROPIC' || provider === 'OPENAI') {
    return { error: t('llmStubProvider', { provider }) };
  }
  return { error: t('selectOllama') };
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export async function updateBrandingAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await requireRole('SUPERADMIN');
  const t = await getTranslations('adminErr');
  const policy = canEditSettings(actor);
  if (!policy.ok) return { error: t(policy.code!) };

  const themeColor = String(formData.get('themeColor') ?? '').trim();
  if (!HEX_COLOR.test(themeColor)) return { error: t('invalidHexColor') };

  let brandLogoKey: string | undefined;
  const logo = formData.get('brandLogo');
  if (logo instanceof File && logo.size > 0) {
    const saved = await saveBrandLogo(Buffer.from(await logo.arrayBuffer()));
    if (!saved.ok) return { error: saved.error ?? t('logoFailed') };
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
  return { ok: true, notice: brandLogoKey ? t('brandingSavedLogo') : t('brandingSaved') };
}

// ---- Impersonation (view-as another user) — ADMIN/SUPERADMIN ----

export async function impersonateUserAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await requireRole('ADMIN');
  const t = await getTranslations('adminErr');
  const targetId = String(formData.get('targetId') ?? '');
  if (targetId === admin.id) return { error: t('alreadyYourself') };

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) return { error: t('userNotFound') };
  if (target.status === 'DEACTIVATED') return { error: t('cannotImpersonateDeactivated') };
  // An admin may not impersonate a superadmin (no upward privilege escalation).
  if (target.role === 'SUPERADMIN' && admin.role !== 'SUPERADMIN') {
    return { error: t('superadminOnlyImpersonate') };
  }

  // Avoid nested impersonation: if we're already impersonating, refuse.
  const current = await validateSession();
  if (current?.impersonatorId) return { error: t('stopImpersonationFirst') };

  const ctx = await getRequestContext();
  // Replace the admin's session with a fresh one for the target, stamped with the
  // real admin's id so it can be unwound and the banner can render.
  await destroyCurrentSession();
  await createSession(target.id, { ...ctx, impersonatorId: admin.id, label: 'impersonation' });
  await audit({ actorId: admin.id, action: 'user.impersonate.start', targetType: 'User', targetId, ip: ctx.ip });
  redirect('/app');
}

export async function stopImpersonatingAction(): Promise<AdminState> {
  const t = await getTranslations('adminErr');
  const current = await validateSession();
  if (!current?.impersonatorId) return { error: t('notImpersonating') };
  const impersonatorId = current.impersonatorId;
  const impersonatedId = current.user.id;

  const ctx = await getRequestContext();
  await destroyCurrentSession(); // end the impersonation session
  // Re-validate the admin before restoring their session: they may have been deactivated
  // or demoted while impersonating (their own sessions were destroyed, but the
  // impersonation session lives under the target's userId and survives). Don't mint a
  // fresh privileged session for an account that's no longer ACTIVE / no longer staff.
  const admin = await prisma.user.findUnique({ where: { id: impersonatorId }, select: { status: true, role: true } });
  if (!admin || admin.status !== 'ACTIVE' || admin.role === 'USER') {
    redirect('/login');
  }
  await createSession(impersonatorId, ctx); // re-establish the real admin's session
  await audit({ actorId: impersonatorId, action: 'user.impersonate.stop', targetType: 'User', targetId: impersonatedId, ip: ctx.ip });
  redirect('/admin/users');
}
