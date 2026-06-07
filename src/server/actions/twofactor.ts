'use server';

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import QRCode from 'qrcode';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { getCurrentUser } from '@/lib/auth/guards';
import { createSession } from '@/lib/auth/session';
import { audit } from '@/lib/auth/audit';
import { getRequestContext } from '@/lib/request';
import { rateLimit } from '@/lib/ratelimit';
import { getSettings } from '@/lib/settings';
import { encryptSecret } from '@/lib/crypto';
import { verifyPassword } from '@/lib/auth/password';
import { logger } from '@/lib/logger';
import { authPageLocale, adoptLocale } from '@/lib/auth/loginLocale';
import { generateTotpSecret, totpAuthUri, verifyTotpStep } from '@/lib/auth/totp';
import {
  setSealedCookie,
  readSealedCookie,
  clearCookie,
  rpInfo,
  generateBackupCodes,
  hashBackupCode,
  verifyUserSecondFactor,
  TOTP_ENROLL_COOKIE,
  WEBAUTHN_REG_COOKIE,
  WEBAUTHN_AUTH_COOKIE,
} from '@/lib/auth/twofactor';

/**
 * Re-authenticate the signed-in user by password before a privileged 2FA mutation
 * (enabling TOTP, adding a passkey). A hijacked session must not be able to silently
 * bind an attacker-controlled second factor — which would also survive the real
 * owner's password reset. Throttled per-user to stop online password guessing.
 */
async function reauthByPassword(userId: string, passwordHash: string | null, password: string): Promise<boolean> {
  const rl = await rateLimit.auth(`2fa-reauth:${userId}`);
  if (!rl.ok) return false;
  return !!passwordHash && (await verifyPassword(passwordHash, password));
}

/**
 * Replace a user's recovery codes (delete all, insert a fresh peppered set) inside
 * the given transaction client. Returns the plaintext codes to show exactly once.
 */
async function rotateBackupCodes(tx: Prisma.TransactionClient, userId: string): Promise<string[]> {
  const codes = generateBackupCodes(10);
  await tx.backupCode.deleteMany({ where: { userId } });
  await tx.backupCode.createMany({ data: codes.map((c) => ({ userId, codeHash: hashBackupCode(c) })) });
  return codes;
}

// ---------------------------------------------------------------------------
// TOTP authenticator-app enrollment
// ---------------------------------------------------------------------------

export interface TotpEnrollStart {
  secret: string;
  uri: string;
  qrSvg: string;
}

/**
 * Begin authenticator-app enrollment: mint a secret, render its QR, and seal the
 * secret in a short-lived cookie. Nothing is written to the account until the
 * user proves they scanned it by entering a valid code (confirmTotpEnrollment).
 */
export async function startTotpEnrollmentAction(password: string): Promise<TotpEnrollStart | { error: string }> {
  const t = await getTranslations('authErr');
  const user = await getCurrentUser();
  if (!user) return { error: t('notSignedIn') };
  if (user.totpEnabledAt) return { error: t('totpAlreadyEnabled') };
  if (!(await reauthByPassword(user.id, user.passwordHash, password))) return { error: t('passwordWrong') };

  const secret = generateTotpSecret();
  const issuer = (await getSettings()).brandName || '1MoreRep';
  const uri = totpAuthUri(secret, user.email, issuer);
  // High-contrast dark-on-white so it scans regardless of the app's theme.
  const qrSvg = await QRCode.toString(uri, { type: 'svg', margin: 1, color: { dark: '#0b0b0b', light: '#ffffff' } });

  await setSealedCookie(TOTP_ENROLL_COOKIE, { secret }, 10 * 60 * 1000);
  return { secret, uri, qrSvg };
}

/**
 * Finish enrollment: verify the first code against the pending secret, then
 * persist the encrypted secret + a fresh set of single-use backup codes. The
 * backup codes are returned ONCE (plaintext) for the user to save.
 */
export async function confirmTotpEnrollmentAction(code: string): Promise<{ backupCodes?: string[]; error?: string }> {
  const t = await getTranslations('authErr');
  const user = await getCurrentUser();
  if (!user) return { error: t('notSignedIn') };
  if (user.totpEnabledAt) return { error: t('totpAlreadyEnabled') };

  const sealed = await readSealedCookie<{ secret: string }>(TOTP_ENROLL_COOKIE);
  if (!sealed?.secret) return { error: t('setupExpired') };
  // Capture the matched time-step so the enrollment code itself can't be replayed as
  // the first login — seed totpLastUsedStep with it. (verifyTotp would not record it.)
  const step = verifyTotpStep(code, sealed.secret);
  if (step === null) return { error: t('codeInvalidCheck') };

  // Enable 2FA and write the backup codes in ONE transaction. Either both land or
  // neither does — no "TOTP enabled but zero backup codes" window if the second write
  // fails. The CAS on totpEnabledAt:null makes a double-submit a no-op that preserves
  // the codes the user may have already saved from the first submit.
  let codes: string[] | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      const enabled = await tx.user.updateMany({
        where: { id: user.id, totpEnabledAt: null },
        data: { totpSecretEnc: encryptSecret(sealed.secret), totpEnabledAt: new Date(), totpLastUsedStep: BigInt(step) },
      });
      if (enabled.count !== 1) return; // concurrent submit already enabled — keep its codes
      codes = await rotateBackupCodes(tx, user.id);
    });
  } catch (err) {
    logger.error({ err, userId: user.id }, '[2fa] TOTP enrollment transaction failed');
    return { error: t('totpEnrollFailed') };
  }
  if (!codes) return { error: t('totpAlreadyEnabled') };

  await clearCookie(TOTP_ENROLL_COOKIE);
  await audit({ actorId: user.id, action: 'auth.2fa.totp.enable', ip: (await getRequestContext()).ip });
  return { backupCodes: codes };
}

/** Disable the authenticator app. Requires a current code (TOTP or backup). */
export async function disableTotpAction(code: string): Promise<{ ok?: true; error?: string }> {
  const t = await getTranslations('authErr');
  const user = await getCurrentUser();
  if (!user) return { error: t('notSignedIn') };
  if (!user.totpEnabledAt) return { error: t('totpNotEnabled') };
  // Throttle the code check — without this a held session could brute-force the 10⁶
  // TOTP space to strip 2FA off the account.
  const rl = await rateLimit.auth(`2fa-reauth:${user.id}`);
  if (!rl.ok) return { error: t('tooManyAttempts') };
  if (!(await verifyUserSecondFactor(user.id, code))) return { error: t('codeInvalid') };

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { totpSecretEnc: null, totpEnabledAt: null, totpLastUsedStep: null } }),
    prisma.backupCode.deleteMany({ where: { userId: user.id } }),
  ]);
  await audit({ actorId: user.id, action: 'auth.2fa.totp.disable', ip: (await getRequestContext()).ip });
  return { ok: true };
}

/** Replace the backup codes with a fresh set. Requires a current TOTP or backup code. */
export async function regenerateBackupCodesAction(code: string): Promise<{ backupCodes?: string[]; error?: string }> {
  const t = await getTranslations('authErr');
  const user = await getCurrentUser();
  if (!user) return { error: t('notSignedIn') };
  if (!user.totpEnabledAt) return { error: t('totpNotEnabled') };
  const rl = await rateLimit.auth(`2fa-reauth:${user.id}`);
  if (!rl.ok) return { error: t('tooManyAttempts') };
  // Accept a TOTP code OR a remaining backup code: a user who has lost their
  // authenticator must still be able to rotate (otherwise they are locked out of
  // recovery entirely). The consumed backup code is replaced by the new set anyway.
  if (!(await verifyUserSecondFactor(user.id, code))) return { error: t('codeInvalid') };

  const codes = await prisma.$transaction((tx) => rotateBackupCodes(tx, user.id));
  await audit({ actorId: user.id, action: 'auth.2fa.backup.regenerate', ip: (await getRequestContext()).ip });
  return { backupCodes: codes };
}

// ---------------------------------------------------------------------------
// WebAuthn passkeys — registration (while signed in)
// ---------------------------------------------------------------------------

export async function startPasskeyRegistrationAction(password: string): Promise<{ options: PublicKeyCredentialCreationOptionsJSON } | { error: string }> {
  const t = await getTranslations('authErr');
  const user = await getCurrentUser();
  if (!user) return { error: t('notSignedIn') };
  if (!(await reauthByPassword(user.id, user.passwordHash, password))) return { error: t('passwordWrong') };

  const { rpID } = await rpInfo();
  const existing = await prisma.webAuthnCredential.findMany({ where: { userId: user.id }, select: { credentialId: true, transports: true } });
  const options = await generateRegistrationOptions({
    rpName: (await getSettings()).brandName || '1MoreRep',
    rpID,
    userName: user.email,
    userID: new TextEncoder().encode(user.id),
    userDisplayName: user.displayName,
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({ id: c.credentialId, transports: c.transports as AuthenticatorTransportFuture[] })),
    // Require user verification (biometric/PIN) so a passkey is a genuine two-factor
    // credential — passwordless login treats it as a complete sign-in, so possession
    // alone must not suffice.
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  });
  await setSealedCookie(WEBAUTHN_REG_COOKIE, { challenge: options.challenge, userId: user.id }, 5 * 60 * 1000);
  return { options };
}

export async function finishPasskeyRegistrationAction(response: RegistrationResponseJSON, name?: string): Promise<{ ok?: true; error?: string }> {
  const t = await getTranslations('authErr');
  const user = await getCurrentUser();
  if (!user) return { error: t('notSignedIn') };
  const sealed = await readSealedCookie<{ challenge: string; userId: string }>(WEBAUTHN_REG_COOKIE);
  if (!sealed || sealed.userId !== user.id) return { error: t('setupExpired') };

  const { rpID, origin } = await rpInfo();
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: sealed.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch (err) {
    logger.warn({ err, userId: user.id }, '[2fa] passkey registration verification threw');
    return { error: t('passkeyRegisterFail') };
  }
  if (!verification.verified || !verification.registrationInfo) return { error: t('passkeyVerifyFail') };

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  await prisma.webAuthnCredential.create({
    data: {
      userId: user.id,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: BigInt(credential.counter),
      transports: credential.transports ?? [],
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      name: name?.trim().slice(0, 40) || null,
    },
  });
  await clearCookie(WEBAUTHN_REG_COOKIE);
  await audit({ actorId: user.id, action: 'auth.2fa.passkey.add' });
  return { ok: true };
}

export async function renamePasskeyAction(id: string, name: string): Promise<{ ok?: true; error?: string }> {
  const t = await getTranslations('authErr');
  const user = await getCurrentUser();
  if (!user) return { error: t('notSignedIn') };
  const result = await prisma.webAuthnCredential.updateMany({ where: { id, userId: user.id }, data: { name: name.trim().slice(0, 40) || null } });
  if (result.count !== 1) return { error: t('passkeyNotFound') };
  return { ok: true };
}

export async function removePasskeyAction(id: string): Promise<{ ok?: true; error?: string }> {
  const t = await getTranslations('authErr');
  const user = await getCurrentUser();
  if (!user) return { error: t('notSignedIn') };
  const result = await prisma.webAuthnCredential.deleteMany({ where: { id, userId: user.id } });
  if (result.count !== 1) return { error: t('passkeyNotFound') };
  await audit({ actorId: user.id, action: 'auth.2fa.passkey.remove' });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// WebAuthn passkeys — passwordless login (signed out)
// ---------------------------------------------------------------------------

export async function startPasskeyLoginAction(): Promise<{ options: PublicKeyCredentialRequestOptionsJSON } | { error: string }> {
  const t = await getTranslations('authErr');
  const ctx = await getRequestContext();
  const rl = await rateLimit.auth(`passkey:${ctx.ip ?? 'noip'}`);
  if (!rl.ok) return { error: t('tooManyAttempts') };

  const { rpID } = await rpInfo();
  // Require user verification: a passwordless passkey login is a complete sign-in, so
  // the authenticator must prove the user (biometric/PIN), not just possession.
  const options = await generateAuthenticationOptions({ rpID, userVerification: 'required', allowCredentials: [] });
  await setSealedCookie(WEBAUTHN_AUTH_COOKIE, { challenge: options.challenge }, 5 * 60 * 1000);
  return { options };
}

/**
 * Complete a passwordless passkey sign-in: look up the credential, verify the
 * assertion against the sealed challenge, roll the signature counter forward, and
 * establish a session. Redirects to /app on success.
 */
export async function finishPasskeyLoginAction(response: AuthenticationResponseJSON): Promise<{ error?: string }> {
  const t = await getTranslations('authErr');
  const sealed = await readSealedCookie<{ challenge: string }>(WEBAUTHN_AUTH_COOKIE);
  if (!sealed) return { error: t('signinExpiredRetry') };

  // select (not include) — never pull passwordHash / totpSecretEnc into memory on a
  // passkey sign-in; only these fields are needed to gate and complete the login.
  const cred = await prisma.webAuthnCredential.findUnique({
    where: { credentialId: response.id },
    select: {
      id: true,
      credentialId: true,
      publicKey: true,
      counter: true,
      transports: true,
      userId: true,
      user: { select: { status: true, lockedUntil: true, locale: true, mustChangePassword: true } },
    },
  });
  if (!cred) return { error: t('passkeyUnrecognized') };
  if (cred.user.status !== 'ACTIVE') return { error: t('accountCantSignIn') };
  // Honour an active lockout — passkey login must not be a way around the brute-force
  // lock the password path enforces.
  if (cred.user.lockedUntil && cred.user.lockedUntil.getTime() > Date.now()) {
    return { error: t('accountCantSignInNow') };
  }

  const { rpID, origin } = await rpInfo();
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: sealed.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: cred.credentialId,
        publicKey: cred.publicKey,
        counter: Number(cred.counter),
        transports: cred.transports as AuthenticatorTransportFuture[],
      },
      requireUserVerification: true,
    });
  } catch (err) {
    logger.warn({ err, credentialId: cred.id }, '[2fa] passkey authentication verification threw');
    return { error: t('passkeyVerifyFail') };
  }
  if (!verification.verified) return { error: t('passkeyVerifyFail') };

  const ctx = await getRequestContext();
  // Advance the signature counter with an optimistic lock on its current value: two
  // concurrent requests replaying the same assertion race here and only the first
  // wins, so a single assertion yields a single session (defends the verify→update
  // TOCTOU for counter-advancing authenticators).
  const advanced = await prisma.webAuthnCredential.updateMany({
    where: { id: cred.id, counter: cred.counter },
    data: { counter: BigInt(verification.authenticationInfo.newCounter), lastUsedAt: new Date() },
  });
  if (advanced.count !== 1) return { error: t('passkeyVerifyFail') };
  await prisma.user.update({
    where: { id: cred.userId },
    data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null, ...adoptLocale(await authPageLocale(), cred.user.locale) },
  });
  await createSession(cred.userId, ctx);
  await clearCookie(WEBAUTHN_AUTH_COOKIE);
  await audit({ actorId: cred.userId, action: 'auth.2fa.passkey.login', ip: ctx.ip });
  // Respect a pending forced password change instead of dropping straight into the app.
  if (cred.user.mustChangePassword) redirect('/account/password?force=1');
  redirect('/app');
}
