import type { TokenType } from '@prisma/client';

const COPY: Record<TokenType, { subject: (b: string) => string; heading: string; body: string; cta: string }> = {
  INVITE: {
    subject: (b) => `You're invited to ${b}`,
    heading: 'Welcome aboard',
    body: 'An admin invited you to join. Click below to set up your account.',
    cta: 'Accept invite',
  },
  EMAIL_VERIFY: {
    subject: (b) => `Verify your email for ${b}`,
    heading: 'Confirm your email',
    body: 'Confirm this address to finish setting up your account.',
    cta: 'Verify email',
  },
  LOGIN_LINK: {
    subject: (b) => `Your ${b} sign-in link`,
    heading: 'Sign in',
    body: 'Use this link to sign in. It expires in 15 minutes and can be used once.',
    cta: 'Sign in',
  },
  PASSWORD_RESET: {
    subject: (b) => `Reset your ${b} password`,
    heading: 'Reset password',
    body: 'Click below to choose a new password. This link expires in 30 minutes.',
    cta: 'Reset password',
  },
  EMAIL_CHANGE: {
    subject: (b) => `Confirm your new email for ${b}`,
    heading: 'Confirm new email',
    body: 'Confirm this new address to update your account email.',
    cta: 'Confirm email',
  },
};

export function renderMagicLinkEmail(
  type: TokenType,
  url: string,
  brand: { brandName: string; themeColor: string },
): { subject: string; html: string; text: string } {
  const c = COPY[type];
  const subject = c.subject(brand.brandName);
  const text = `${c.heading}\n\n${c.body}\n\n${c.cta}: ${url}\n\nIf you didn't request this, you can ignore this email.`;
  const html = `<!doctype html><html><body style="margin:0;background:#f1eee6;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#211f19">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px">
    <div style="font-size:18px;font-weight:700;letter-spacing:-.02em;margin-bottom:24px">${escapeHtml(brand.brandName)}</div>
    <div style="background:#fbfaf6;border:1px solid #e6e2d7;border-radius:16px;padding:28px">
      <h1 style="font-size:20px;margin:0 0 10px">${c.heading}</h1>
      <p style="font-size:15px;line-height:1.5;color:#6c685c;margin:0 0 22px">${c.body}</p>
      <a href="${escapeAttr(url)}" style="display:inline-block;background:${escapeAttr(brand.themeColor)};color:#fffaf6;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:12px">${c.cta}</a>
      <p style="font-size:12px;color:#9c978b;margin:22px 0 0">If you didn't request this, you can safely ignore this email.</p>
    </div>
  </div></body></html>`;
  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}
