import 'server-only';
import nodemailer from 'nodemailer';
import type { TokenType } from '@prisma/client';
import { getSettings, resolveSmtp } from '@/lib/settings';
import { logger } from '@/lib/logger';
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
    logger.warn(
      { to: opts.to, subject: opts.subject },
      '[mail] SMTP not configured — logging email to console (configure SMTP in admin settings)',
    );
    // eslint-disable-next-line no-console
    console.log(`\n──── EMAIL (no SMTP) ────\nTo: ${opts.to}\nSubject: ${opts.subject}\n${opts.text}\n─────────────────────────\n`);
    return { delivered: 'console' };
  }

  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    pool: true,
  });

  await transport.sendMail({ from: smtp.from, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text });
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
  try {
    const t = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    });
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
  }
}
