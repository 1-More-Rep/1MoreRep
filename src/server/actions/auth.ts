'use server';

import { redirect } from 'next/navigation';
import type { TokenType } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { getSettings } from '@/lib/settings';
import { verifyPassword, hashPassword } from '@/lib/auth/password';
import { createSession, destroyAllSessions, destroyCurrentSession, destroyOtherSessions, currentSessionId } from '@/lib/auth/session';
import { getCurrentUser } from '@/lib/auth/guards';
import { consumeToken, issueToken } from '@/lib/auth/tokens';
import { audit } from '@/lib/auth/audit';
import { sendMagicLink } from '@/lib/mail';
import { getRequestContext } from '@/lib/request';
import { rateLimit } from '@/lib/ratelimit';
import { LOGIN_LOCK_THRESHOLD, LOGIN_LOCK_DURATION_MS } from '@/lib/auth/constants';
import { loginSchema, magicRequestSchema, registerSchema, resetRequestSchema, setPasswordSchema } from '@/lib/validation/auth';

export interface ActionState {
  error?: string;
  ok?: boolean;
  notice?: string;
}

const NEUTRAL = 'If that account exists, check your email for a link.';

/** Password login. Enumeration-safe + throttled + lockout. */
export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({ email: formData.get('email'), password: formData.get('password') });
  if (!parsed.success) return { error: 'Enter a valid email and password.' };
  const { email, password } = parsed.data;
  const ctx = await getRequestContext();

  const rl = await rateLimit.auth(`login:${ctx.ip ?? 'noip'}:${email}`);
  if (!rl.ok) return { error: 'Too many attempts. Try again shortly.' };

  const user = await prisma.user.findUnique({ where: { email } });
  const genericFail: ActionState = { error: 'Invalid email or password.' };

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

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await createSession(user.id, ctx);
  await audit({ actorId: user.id, action: 'auth.login.success', ip: ctx.ip });

  if (user.mustChangePassword) redirect('/account/password?force=1');
  redirect('/app');
}

/** Request a passwordless login link. Always returns a neutral message. */
export async function magicLinkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = magicRequestSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { error: 'Enter a valid email.' };
  const { email } = parsed.data;
  const ctx = await getRequestContext();

  const rl = await rateLimit.email(email);
  if (!rl.ok) return { ok: true, notice: NEUTRAL };

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && user.status !== 'DEACTIVATED') {
    const { url } = await issueToken('LOGIN_LINK', user.id, { ip: ctx.ip });
    await sendMagicLink('LOGIN_LINK', email, url);
    await audit({ actorId: user.id, action: 'auth.magic.request', ip: ctx.ip });
  }
  return { ok: true, notice: NEUTRAL };
}

/** Self-registration (only when the instance allows it). */
export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const settings = await getSettings();
  if (!settings.allowSelfRegistration) return { error: 'Registration is disabled on this instance.' };

  const parsed = registerSchema.safeParse({
    email: formData.get('email'),
    displayName: formData.get('displayName'),
    handle: formData.get('handle'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check your details.' };
  const { email, displayName, handle, password } = parsed.data;
  const ctx = await getRequestContext();

  const rl = await rateLimit.auth(`register:${ctx.ip ?? 'noip'}`);
  if (!rl.ok) return { error: 'Too many attempts. Try again shortly.' };

  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { publicHandle: handle }] } });
  if (existing) return { error: 'That email or handle is already taken.' };

  const requireVerify = settings.requireEmailVerification;
  const user = await prisma.user.create({
    data: {
      email,
      displayName,
      publicHandle: handle,
      passwordHash: await hashPassword(password),
      role: 'USER',
      status: requireVerify ? 'INVITED' : 'ACTIVE',
      emailVerifiedAt: requireVerify ? null : new Date(),
    },
  });
  await audit({ actorId: user.id, action: 'auth.register', ip: ctx.ip });

  if (requireVerify) {
    const { url } = await issueToken('EMAIL_VERIFY', user.id, { ip: ctx.ip });
    await sendMagicLink('EMAIL_VERIFY', email, url);
    return { ok: true, notice: 'Account created. Check your email to verify before signing in.' };
  }

  await createSession(user.id, ctx);
  redirect('/onboarding');
}

/** Request a password reset link (neutral response). */
export async function resetRequestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetRequestSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { error: 'Enter a valid email.' };
  const { email } = parsed.data;
  const ctx = await getRequestContext();
  const rl = await rateLimit.email(email);
  if (rl.ok) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.status !== 'DEACTIVATED') {
      const { url } = await issueToken('PASSWORD_RESET', user.id, { ip: ctx.ip });
      await sendMagicLink('PASSWORD_RESET', email, url);
    }
  }
  return { ok: true, notice: NEUTRAL };
}

export async function logoutAction(): Promise<void> {
  await destroyCurrentSession();
  redirect('/login');
}

/**
 * Consume an auth-callback token (called from the confirm POST, never on GET).
 * Performs the type-specific side effect and establishes a session where apt.
 */
export async function consumeCallbackAction(type: TokenType, rawToken: string): Promise<{ error?: string }> {
  const ctx = await getRequestContext();
  // Throttle token consumption per-IP (W1-T8) — brute-force defense beyond entropy.
  const rl = await rateLimit.auth(`consume:${ctx.ip ?? 'noip'}`);
  if (!rl.ok) return { error: 'Too many attempts. Try again shortly.' };
  const result = await consumeToken(type, rawToken);
  if (!result) return { error: 'This link is invalid or has expired.' };
  const { userId, payload } = result;

  switch (type) {
    case 'LOGIN_LINK': {
      // Clear any prior password-login lockout on successful magic-link login (W1-T9).
      await prisma.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
      });
      await createSession(userId, ctx);
      await audit({ actorId: userId, action: 'auth.magic.login', ip: ctx.ip });
      redirect('/app');
      break;
    }
    case 'INVITE': {
      await prisma.user.update({
        where: { id: userId },
        data: { status: 'ACTIVE', emailVerifiedAt: new Date() },
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
          return { error: 'That email is already in use.' };
        }
        try {
          await prisma.user.update({
            where: { id: userId },
            data: { email: newEmail, pendingEmail: null, emailVerifiedAt: new Date() },
          });
        } catch {
          // Unique-constraint race between the check and the update.
          return { error: 'That email is already in use.' };
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
  const type = String(formData.get('type') ?? '') as TokenType;
  const token = String(formData.get('token') ?? '');
  if (!VALID_TYPES.includes(type)) return { error: 'Invalid link.' };
  const r = await consumeCallbackAction(type, token);
  return r.error ? { error: r.error } : {};
}

/** Set a new password for the current authenticated session (reset/first-login). */
export async function setPasswordAction(userId: string, formData: FormData): Promise<ActionState> {
  const parsed = setPasswordSchema.safeParse({ password: formData.get('password') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid password.' };
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
  return { ok: true, notice: 'Password updated.' };
}

/** Session-bound password change (reset / first-login / account). Redirects on success. */
export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Not signed in.' };
  const result = await setPasswordAction(user.id, formData);
  if (result.error) return result;
  redirect('/app');
}
