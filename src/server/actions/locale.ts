'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/server/db/prisma';
import { getCurrentUser } from '@/lib/auth/guards';
import { isLocale, LOCALE_COOKIE, type Locale } from '@/i18n/config';

const ONE_YEAR = 60 * 60 * 24 * 365;

async function setLocaleCookie(locale: Locale) {
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: ONE_YEAR,
    sameSite: 'lax',
  });
}

/**
 * Persist the chosen locale. Writes the cookie (drives the next render) and, when
 * signed in, the account's User.locale so the choice follows the user across
 * devices. Safe to call unauthenticated (auth-page selector) — cookie only.
 */
export async function saveLocaleAction(value: string): Promise<void> {
  if (!isLocale(value)) return;
  await setLocaleCookie(value);
  const user = await getCurrentUser();
  if (user) {
    await prisma.user.update({ where: { id: user.id }, data: { locale: value } });
  }
  revalidatePath('/', 'layout');
}
