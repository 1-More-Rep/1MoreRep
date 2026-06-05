import 'server-only';
import nodemailer from 'nodemailer';
import type { TokenType } from '@prisma/client';
import { getSettings, resolveSmtp } from '@/lib/settings';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';
import { renderMagicLinkEmail } from './templates';

export interface SendResult {
  delivered: 'smtp' | 'console';
}

/**
 * Send an email via the admin-configured SMTP. If SMTP is not configured, fall
 * back to logging the message (and any link) to stdout so first-boot and local
 * dev work without a mail server. The fallback is loud, never silent.
 */
export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const settings = await getSettings();
  const smtp = resolveSmtp(settings);

  if (!smtp) {
    // In production we must NOT print the message (it can contain a magic-link /
    // password-reset token) to stdout, where it would land in `docker logs`. Surface
    // the misconfiguration loudly instead; the email is simply not delivered.
    if (env.NODE_ENV === 'production') {
      logger.error(
        { to: opts.to, subject: opts.subject },
        '[mail] SMTP not configured in production — email NOT sent. Configure SMTP in admin settings.',
      );
      return { delivered: 'console' };
    }
    logger.warn(
      { to: opts.to, subject: opts.subject },
      '[mail] SMTP not configured — logging email to console (dev only; configure SMTP in admin settings)',
    );
    // eslint-disable-next-line no-console
    console.log(`\n──── EMAIL (no SMTP) ────\nTo: ${opts.to}\nSubject: ${opts.subject}\n${opts.text}\n─────────────────────────\n`);
    return { delivered: 'console' };
  }

  // One-shot transport (no pool): the connection opens, sends, and closes — a pooled
  // transport created per-call and never closed leaks SMTP sockets. Timeouts bound a
  // stalled/tarpitting relay so auth flows can't hang for nodemailer's 10-minute default.
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  try {
    await transport.sendMail({ from: smtp.from, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text });
  } finally {
    transport.close();
  }
  return { delivered: 'smtp' };
}

/** Send a typed magic-link email. */
export async function sendMagicLink(type: TokenType, to: string, url: string): Promise<SendResult> {
  const settings = await getSettings();
  const { subject, html, text } = renderMagicLinkEmail(type, url, {
    brandName: settings.brandName,
    themeColor: settings.themeColor,
  });
  return sendMail({ to, subject, html, text });
}

/**
 * Verify SMTP connectivity (admin "send test" support). When `sendTo` is given,
 * also delivers a small test email and surfaces any send error; otherwise only
 * the connection is verified.
 */
export async function verifySmtp(sendTo?: string | null): Promise<{ ok: boolean; sent?: boolean; error?: string }> {
  const settings = await getSettings();
  const smtp = resolveSmtp(settings);
  if (!smtp) return { ok: false, error: 'SMTP not configured' };
  // Mirror sendMail's hardening: bound a stalled/tarpitting relay with timeouts (otherwise
  // the admin "send test" can hang for nodemailer's 10-minute default) and always close the
  // transport in finally so each test doesn't leak an SMTP socket.
  const t = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  try {
    await t.verify();

    const recipient = sendTo?.trim() || smtp.from;
    if (recipient) {
      const subject = `${settings.brandName} — SMTP test`;
      const text = `This is a test email from ${settings.brandName}. If you received it, outgoing mail is working.`;
      const html = `<p>This is a test email from <strong>${settings.brandName}</strong>. If you received it, outgoing mail is working.</p>`;
      await t.sendMail({ from: smtp.from, to: recipient, subject, html, text });
      return { ok: true, sent: true };
    }
    return { ok: true, sent: false };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'verify failed' };
  } finally {
    t.close();
  }
}
