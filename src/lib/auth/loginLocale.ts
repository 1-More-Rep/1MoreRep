import 'server-only';
import { cookies } from 'next/headers';
import { isLocale, LOCALE_COOKIE, type Locale } from '@/i18n/config';

/**
 * The language the visitor picked on the auth pages (persisted to the locale
 * cookie by the language selector). Adopted into User.locale at login so the
 * login-screen choice follows the account instead of being reset to the account
 * default by LocaleSync. Returns null when no explicit, valid choice is present.
 */
export async function authPageLocale(): Promise<Locale | null> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : null;
}

/** Patch to fold the auth-page locale into a user update, only when it differs. */
export function adoptLocale(chosen: Locale | null, current: string): { locale?: Locale } {
  return chosen && chosen !== current ? { locale: chosen } : {};
}
