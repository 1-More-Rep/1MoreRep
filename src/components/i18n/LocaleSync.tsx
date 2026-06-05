'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LOCALE_COOKIE } from '@/i18n/config';

/**
 * Keeps the locale cookie in sync with the signed-in account's User.locale, so the
 * language follows the user across devices (account is the source of truth). On a
 * device whose cookie disagrees with the account, it corrects the cookie and
 * refreshes once. Mirrors AppearanceSync for theme.
 */
export function LocaleSync({ locale }: { locale: string }) {
  const router = useRouter();
  useEffect(() => {
    const current = document.cookie
      .split('; ')
      .find((c) => c.startsWith(`${LOCALE_COOKIE}=`))
      ?.split('=')[1];
    if (current !== locale) {
      document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      router.refresh();
    }
  }, [locale, router]);
  return null;
}
