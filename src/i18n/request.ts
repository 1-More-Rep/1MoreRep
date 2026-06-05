import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, matchAcceptLanguage, type Locale } from './config';
import { loadMessages } from './messages';

/**
 * Resolve the active locale for a request WITHOUT URL-based routing (locale is
 * account-scoped). Priority: the locale cookie (set at login / by the selector,
 * mirrors the signed-in user's User.locale) → the browser's Accept-Language →
 * the default. The cookie is kept in sync with the account by LocaleSync.
 */
export async function resolveLocale(): Promise<Locale> {
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  const accept = (await headers()).get('accept-language');
  return matchAcceptLanguage(accept) ?? DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return { locale, messages: loadMessages(locale) };
});
