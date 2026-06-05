import type { TokenType } from '@prisma/client';
import { getTranslator } from '@/i18n/translator';

/**
 * Render a magic-link email in the recipient's locale. Copy lives in the `email`
 * namespace of the message catalogs, keyed by TokenType.
 */
export function renderMagicLinkEmail(
  type: TokenType,
  url: string,
  brand: { brandName: string; themeColor: string },
  locale: string,
): { subject: string; html: string; text: string } {
  const t = getTranslator(locale);
  const tr = (k: string, values?: Record<string, string>) => t(`email.${type}.${k}` as never, values as never) as string;
  const subject = tr('subject', { brand: brand.brandName });
  const heading = tr('heading');
  const body = tr('body');
  const cta = tr('cta');
  const ignore = t('email.ignore' as never) as string;

  const text = `${heading}\n\n${body}\n\n${cta}: ${url}\n\n${ignore}`;
  const html = `<!doctype html><html><body style="margin:0;background:#f1eee6;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#211f19">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px">
    <div style="font-size:18px;font-weight:700;letter-spacing:-.02em;margin-bottom:24px">${escapeHtml(brand.brandName)}</div>
    <div style="background:#fbfaf6;border:1px solid #e6e2d7;border-radius:16px;padding:28px">
      <h1 style="font-size:20px;margin:0 0 10px">${escapeHtml(heading)}</h1>
      <p style="font-size:15px;line-height:1.5;color:#6c685c;margin:0 0 22px">${escapeHtml(body)}</p>
      <a href="${escapeAttr(url)}" style="display:inline-block;background:${escapeAttr(brand.themeColor)};color:#fffaf6;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:12px">${escapeHtml(cta)}</a>
      <p style="font-size:12px;color:#9c978b;margin:22px 0 0">${escapeHtml(ignore)}</p>
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
