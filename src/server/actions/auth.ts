'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import type { TokenType } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { isLocale, LOCALE_COOKIE } from '@/i18n/config';
import { authPageLocale, adoptLocale } from '@/lib/auth/loginLocale';
import {
  requiresSecondFactor,
  verifyUserSecondFactor,
  setSealedCookie,
  readSealedCookie,
  clearCookie,
  TWOFA_PENDING_COOKIE,
} from '@/lib/auth/twofactor';
import { getSettings } from '@/lib/settings';
import { verifyPassword, hashPassword } from '@/lib/auth/password';
import { createSession, destroyAllSessions, destroyCurrentSession, destroyOtherSessions, currentSessionId } from '@/lib/auth/session';
import { getCurrentUser } from '@/lib/auth/guards';
import { consumeToken, issueToken } from '@/lib/auth/tokens';
import { audit } from '@/lib/auth/audit';
import { sendMagicLink } from '@/lib/mail';
import { getRequestContext } from '@/lib/request';
import { rateLimit } from '@/lib/ratelimit';
import { logger } from '@/lib/logger';
import { LOGIN_LOCK_THRESHOLD, LOGIN_LOCK_DURATION_MS } from '@/lib/auth/constants';
import { loginSchema, magicRequestSchema, registerSchema, resetRequestSchema, setPasswordSchema } from '@/lib/validation/auth';

export interface ActionState {
  error?: string;
  ok?: boolean;
  notice?: string;
  /** Set when password was correct but a second factor (TOTP) is still required. */
  twoFactor?: boolean;
}

/** Password login. Enumeration-safe + throttled + lockout. */
export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getTranslations('authErr');
  const parsed = loginSchema.safeParse({ email: formData.get('email'), password: formData.get('password') });
  if (!parsed.success) return { error: t('enterEmailPassword') };
  const { email, password } = parsed.data;
  const ctx = await getRequestContext();

  const rl = await rateLimit.auth(`login:${ctx.ip ?? 'noip'}:${email}`);
  if (!rl.ok) return { error: 'Too many attempts. Try again shortly.' };

  const user = await prisma.user.findUnique({ where: { email } });
  const genericFail: ActionState = { error: t('invalidCredentials') };

  if (!user || !user.passwordHash || user.status === 'DEACTIVATED') return genericFail;
  // Locked accounts return the SAME generic failure as bad creds — no
  // enumeration oracle distinguishing a real locked account (W1-T10).
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    await audit({ actorId: user.id, action: 'auth.login.locked', ip: ctx.ip });
    return genericFail;
  }

  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) {
    const fails = user.failedLoginCount + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: fails,
        lockedUntil: fails >= LOGIN_LOCK_THRESHOLD ? new Date(Date.now() + LOGIN_LOCK_DURATION_MS) : null,
      },
    });
    await audit({ actorId: user.id, action: 'auth.login.fail', ip: ctx.ip });
    return genericFail;
  }

  // Correct password, but the account never verified its email (self-registered while
  // requireEmailVerification was on → status INVITED). Do NOT establish a session here:
  // password login must not be a path around email verification.
  if (user.status === 'INVITED') {
    await audit({ actorId: user.id, action: 'auth.login.unverified', ip: ctx.ip });
    return { error: t('verifyEmailFirst') };
  }

  // Password is correct — clear the brute-force counters regardless of what comes next.
  await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });

  // Second factor required (authenticator app): do NOT establish a session yet.
  // Seal the user id in a short-lived cookie; verifyTwoFactorAction completes login.
  if (requiresSecondFactor(user)) {
    await setSealedCookie(TWOFA_PENDING_COOKIE, { userId: user.id, mustChangePassword: user.mustChangePassword }, 10 * 60 * 1000);
    await audit({ actorId: user.id, action: 'auth.login.2fa.challenge', ip: ctx.ip });
    return { twoFactor: true };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), ...adoptLocale(await authPageLocale(), user.locale) },
  });
  await createSession(user.id, ctx);
  await audit({ actorId: user.id, action: 'auth.login.success', ip: ctx.ip });

  if (user.mustChangePassword) redirect('/account/password?force=1');
  redirect('/app');
}

/**
 * Second-factor step of password login: verify a TOTP code or a single-use backup
 * code against the user pinned in the sealed pending cookie, then establish the
 * session. Throttled per-user to slow online code-guessing.
 */
export async function verifyTwoFactorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getTranslations('authErr');
  const pending = await readSealedCookie<{ userId: string; mustChangePassword?: boolean; reset?: boolean }>(TWOFA_PENDING_COOKIE);
  if (!pending) return { error: t('signinExpiredStart') };

  const code = String(formData.get('code') ?? '').trim();
  if (!code) return { error: t('enterCode'), twoFactor: true };

  const ctx = await getRequestContext();
  const rl = await rateLimit.auth(`2fa:${pending.userId}`);
  if (!rl.ok) return { error: t('tooManyAttempts'), twoFactor: true };

  const method = await verifyUserSecondFactor(pending.userId, code);
  if (!method) {
    await audit({ actorId: pending.userId, action: 'auth.login.2fa.fail', ip: ctx.ip });
    return { error: t('codeInvalidRetry'), twoFactor: true };
  }

  const user = await prisma.user.findUnique({ where: { id: pending.userId }, select: { status: true, locale: true } });
  if (!user || user.status !== 'ACTIVE') {
    await clearCookie(TWOFA_PENDING_COOKIE);
    return { error: t('signinExpiredStart') };
  }

  await prisma.user.update({
    where: { id: pending.userId },
    data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null, ...adoptLocale(await authPageLocale(), user.locale) },
  });
  // A reset-link second factor revokes every other session before issuing the new one
  // (matches the non-2FA reset path), then sends the user on to set a new password.
  if (pending.reset) await destroyAllSessions(pending.userId);
  await createSession(pending.userId, ctx);
  await clearCookie(TWOFA_PENDING_COOKIE);
  // Record which factor completed the login (TOTP vs. recovery code) — a sudden
  // jump in backup-code use is a useful account-compromise signal. Not sensitive.
  await audit({ actorId: pending.userId, action: pending.reset ? 'auth.reset.consume' : 'auth.login.2fa.success', ip: ctx.ip, metadata: { method } });

  if (pending.reset) redirect('/account/password?reset=1');
  if (pending.mustChangePassword) redirect('/account/password?force=1');
  redirect('/app');
}

/** Request a passwordless login link. Always returns a neutral message. */
export async function magicLinkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getTranslations('authErr');
  const parsed = magicRequestSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { error: t('enterEmail') };
  const { email } = parsed.data;
  const ctx = await getRequestContext();

  const rl = await rateLimit.email(email);
  if (!rl.ok) return { ok: true, notice: t('neutralEmailSent') };

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && user.status !== 'DEACTIVATED') {
    const { url } = await issueToken('LOGIN_LINK', user.id, { ip: ctx.ip });
    // A mail-transport failure must NOT surface as a 500 (it would also be an
    // enumeration oracle: error vs neutral reveals the address exists). Log and
    // still return the neutral message.
    try {
      await sendMagicLink('LOGIN_LINK', email, url);
      await audit({ actorId: user.id, action: 'auth.magic.request', ip: ctx.ip });
    } catch (err) {
      logger.error({ err }, '[auth] magic-link email failed to send');
    }
  }
  return { ok: true, notice: t('neutralEmailSent') };
}

/** Self-registration (only when the instance allows it). */
export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getTranslations('authErr');
  const settings = await getSettings();
  if (!settings.allowSelfRegistration) return { error: t('registrationDisabled') };

  const parsed = registerSchema.safeParse({
    email: formData.get('email'),
    displayName: formData.get('displayName'),
    handle: formData.get('handle'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t('checkDetails') };
  const { email, displayName, handle, password } = parsed.data;
  const ctx = await getRequestContext();

  const rl = await rateLimit.auth(`register:${ctx.ip ?? 'noip'}`);
  if (!rl.ok) return { error: t('tooManyAttempts') };

  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { publicHandle: handle }] } });
  if (existing) return { error: t('emailOrHandleTaken') };

  const requireVerify = settings.requireEmailVerification;
  // Capture the language chosen on the auth page (cookie) so the account starts in it.
  const localeCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(localeCookie) ? localeCookie : 'en';
  const user = await prisma.user.create({
    data: {
      email,
      displayName,
      publicHandle: handle,
      passwordHash: await hashPassword(password),
      role: 'USER',
      status: requireVerify ? 'INVITED' : 'ACTIVE',
      emailVerifiedAt: requireVerify ? null : new Date(),
      locale,
    },
  });
  await audit({ actorId: user.id, action: 'auth.register', ip: ctx.ip });

  if (requireVerify) {
    const { url } = await issueToken('EMAIL_VERIFY', user.id, { ip: ctx.ip });
    // The account already exists (INVITED); a failed verification email shouldn't surface as a
    // raw 500. Tell the user it couldn't be sent so they can retry/contact the admin.
    try {
      await sendMagicLink('EMAIL_VERIFY', email, url);
    } catch (err) {
      logger.error({ err }, '[auth] verification email failed to send during registration');
      return { ok: true, notice: t('accountCreatedEmailFailed') };
    }
    return { ok: true, notice: t('accountCreatedVerify') };
  }

  await createSession(user.id, ctx);
  redirect('/onboarding');
}

/** Request a password reset link (neutral response). */
export async function resetRequestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getTranslations('authErr');
  const parsed = resetRequestSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { error: t('enterEmail') };
  const { email } = parsed.data;
  const ctx = await getRequestContext();
  const rl = await rateLimit.email(email);
  if (rl.ok) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.status !== 'DEACTIVATED') {
      const { url } = await issueToken('PASSWORD_RESET', user.id, { ip: ctx.ip });
      // As with magic-link: never let SMTP failure become a 500 / enumeration oracle.
      try {
        await sendMagicLink('PASSWORD_RESET', email, url);
        await audit({ actorId: user.id, action: 'auth.reset.request', ip: ctx.ip });
      } catch (err) {
        logger.error({ err }, '[auth] password-reset email failed to send');
      }
    }
  }
  return { ok: true, notice: t('neutralEmailSent') };
}

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  await destroyCurrentSession();
  if (user) await audit({ actorId: user.id, action: 'auth.logout' });
  redirect('/login');
}

/**
 * Consume an auth-callback token (called from the confirm POST, never on GET).
 * Performs the type-specific side effect and establishes a session where apt.
 */
export async function consumeCallbackAction(type: TokenType, rawToken: string): Promise<{ error?: string }> {
  const t = await getTranslations('authErr');
  const ctx = await getRequestContext();
  // Throttle token consumption per-IP (W1-T8) — brute-force defense beyond entropy.
  // Only when we actually have a client IP: without a trusted proxy (TRUST_PROXY=false)
  // ctx.ip is null for everyone, so keying on a constant 'noip' would collapse all users
  // into ONE shared 10/min bucket — a single client could then lock out every user's
  // magic-link / reset / invite consumption (DoS). Tokens are 256-bit, single-use and
  // hashed at rest, so entropy already defeats brute force; this limit is defense-in-depth.
  if (ctx.ip) {
    const rl = await rateLimit.auth(`consume:${ctx.ip}`);
    if (!rl.ok) return { error: t('tooManyAttempts') };
  }
  const result = await consumeToken(type, rawToken);
  if (!result) return { error: t('linkInvalid') };
  const { userId, payload } = result;

  // Re-check the account's current status at consume time. consumeToken validates the
  // token but knows nothing about the user, so without this an outstanding token could:
  //  (a) let a DEACTIVATED user reactivate themselves (INVITE/EMAIL_VERIFY flip to ACTIVE),
  //      or get a session (LOGIN_LINK/PASSWORD_RESET) — i.e. reverse an admin deactivation;
  //  (b) let an INVITED (email-unverified) user obtain a full session via LOGIN_LINK,
  //      bypassing the email-verification gate that password login enforces (line 64).
  const tokenUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true, locale: true, totpEnabledAt: true, mustChangePassword: true },
  });
  if (!tokenUser) return { error: t('linkInvalid') };
  if (tokenUser.status === 'DEACTIVATED') return { error: t('accountDeactivated') };
  if (type === 'LOGIN_LINK' && tokenUser.status !== 'ACTIVE') {
    return { error: t('verifyEmailFirstVerification') };
  }

  switch (type) {
    case 'LOGIN_LINK': {
      // Magic-link is single-factor (email possession). If the account opted into a
      // second factor, it MUST also be demanded here — otherwise enabling TOTP would
      // be defeated by anyone with inbox access. Defer the session AND any login-state
      // mutation to the 2FA step: an inbox-only attacker must not be able to clear a
      // victim's brute-force lockout / stamp lastLoginAt without passing the factor.
      if (requiresSecondFactor(tokenUser)) {
        await setSealedCookie(
          TWOFA_PENDING_COOKIE,
          { userId, mustChangePassword: tokenUser.mustChangePassword },
          10 * 60 * 1000,
        );
        await audit({ actorId: userId, action: 'auth.login.2fa.challenge', ip: ctx.ip });
        redirect('/login?mfa=1');
      }
      // Single-factor success: clear any prior password-login lockout (W1-T9).
      await prisma.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null, ...adoptLocale(await authPageLocale(), tokenUser.locale) },
      });
      await createSession(userId, ctx);
      await audit({ actorId: userId, action: 'auth.magic.login', ip: ctx.ip });
      redirect('/app');
      break;
    }
    case 'INVITE': {
      await prisma.user.update({
        where: { id: userId },
        data: { status: 'ACTIVE', emailVerifiedAt: new Date(), ...adoptLocale(await authPageLocale(), tokenUser.locale) },
      });
      await createSession(userId, ctx);
      await audit({ actorId: userId, action: 'auth.invite.accept', ip: ctx.ip });
      redirect('/account/password?welcome=1');
      break;
    }
    case 'EMAIL_VERIFY': {
      await prisma.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: new Date(), status: 'ACTIVE' },
      });
      await audit({ actorId: userId, action: 'auth.email.verify', ip: ctx.ip });
      redirect('/login?verified=1');
      break;
    }
    case 'PASSWORD_RESET': {
      // A reset link proves email possession only. With a second factor enabled, the
      // attacker-with-inbox must still pass it before getting a session (recovery is
      // still possible via a backup code). The session + session-revocation happen in
      // verifyTwoFactorAction once the factor checks out.
      if (requiresSecondFactor(tokenUser)) {
        await setSealedCookie(TWOFA_PENDING_COOKIE, { userId, reset: true }, 10 * 60 * 1000);
        await audit({ actorId: userId, action: 'auth.login.2fa.challenge', ip: ctx.ip });
        redirect('/login?mfa=1');
      }
      // Establish a short session so the user can set a new password; revoke others.
      await destroyAllSessions(userId);
      await createSession(userId, ctx);
      await audit({ actorId: userId, action: 'auth.reset.consume', ip: ctx.ip });
      redirect('/account/password?reset=1');
      break;
    }
    case 'EMAIL_CHANGE': {
      const newEmail = (payload as { newEmail?: string } | null)?.newEmail;
      if (newEmail) {
        // Re-check uniqueness at consume time — the target may have been
        // registered by someone else after the change was requested (W1-T7).
        const taken = await prisma.user.findFirst({ where: { email: newEmail, NOT: { id: userId } } });
        if (taken) {
          await prisma.user.update({ where: { id: userId }, data: { pendingEmail: null } }).catch(() => {});
          return { error: t('emailInUse') };
        }
        try {
          await prisma.user.update({
            where: { id: userId },
            data: { email: newEmail, pendingEmail: null, emailVerifiedAt: new Date() },
          });
        } catch {
          // Unique-constraint race between the check and the update.
          return { error: t('emailInUse') };
        }
      }
      await audit({ actorId: userId, action: 'auth.email.change', ip: ctx.ip });
      redirect('/account?emailChanged=1');
      break;
    }
  }
  return {};
}

const VALID_TYPES: TokenType[] = ['LOGIN_LINK', 'INVITE', 'EMAIL_VERIFY', 'PASSWORD_RESET', 'EMAIL_CHANGE'];

/** Form-bound confirm action for the auth callback (POST consumes the token). */
export async function callbackConfirmAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getTranslations('authErr');
  const typeRaw = String(formData.get('type') ?? '');
  const token = String(formData.get('token') ?? '');
  // Validate membership BEFORE narrowing to TokenType — no unchecked `as` into the
  // type system, the cast only happens once the value is proven to be a TokenType.
  if (!VALID_TYPES.includes(typeRaw as TokenType)) return { error: t('linkInvalidShort') };
  const type = typeRaw as TokenType;
  const r = await consumeCallbackAction(type, token);
  return r.error ? { error: r.error } : {};
}

/**
 * Set a new password for `userId`. INTERNAL helper — intentionally NOT exported, so
 * it is never a callable server-action endpoint. The only caller is
 * changePasswordAction, which derives userId from the authenticated session. Keeping
 * it un-exported means there is no way to invoke it with an attacker-supplied userId.
 */
async function setPasswordForUser(userId: string, formData: FormData): Promise<ActionState> {
  const t = await getTranslations('authErr');
  const parsed = setPasswordSchema.safeParse({ password: formData.get('password') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t('invalidPassword') };
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(parsed.data.password), mustChangePassword: false },
  });
  // Revoke every other session on a password change (W1-T6) — a thief's session
  // dies the moment the real owner changes the password. Keep the current device.
  const keep = await currentSessionId();
  if (keep) await destroyOtherSessions(userId, keep);
  else await destroyAllSessions(userId);
  await audit({ actorId: userId, action: 'auth.password.set' });
  return { ok: true, notice: t('passwordUpdated') };
}

/** Session-bound password change (reset / first-login / account). Redirects on success. */
export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getTranslations('authErr');
  const user = await getCurrentUser();
  if (!user) return { error: t('notSignedIn') };
  const result = await setPasswordForUser(user.id, formData);
  if (result.error) return result;
  redirect('/app');
}
