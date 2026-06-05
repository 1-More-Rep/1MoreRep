import 'server-only';
import { createTranslator } from 'next-intl';
import { DEFAULT_LOCALE, isLocale, type Locale } from './config';
import { loadMessages } from './messages';

/**
 * A translator bound to an explicit locale, for server-side contexts with NO
 * request scope: emails, web-push, and cron jobs must render in the RECIPIENT's
 * locale (looked up from User.locale), not the current request's.
 */
export function getTranslator(locale: string | null | undefined) {
  const loc: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE;
  return createTranslator({ locale: loc, messages: loadMessages(loc) });
}
