'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import type { Sex, UnitSystem } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { requireUser } from '@/lib/auth/guards';
import { issueToken } from '@/lib/auth/tokens';
import { sendMagicLink } from '@/lib/mail';
import { logger } from '@/lib/logger';
import { emailSchema } from '@/lib/validation/auth';

export interface AccountState {
  error?: string;
  notice?: string;
}

export async function updateAccountAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const t = await getTranslations('authErr');
  const user = await requireUser();
  const displayName = String(formData.get('displayName') ?? '').trim();
  if (displayName.length < 1 || displayName.length > 60) return { error: t('enterDisplayName') };
  let timezone = String(formData.get('timezone') ?? 'UTC');
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    timezone = 'UTC';
  }
  const sexRaw = String(formData.get('sex') ?? 'UNSPECIFIED');
  const sex: Sex = sexRaw === 'FEMALE' || sexRaw === 'MALE' ? sexRaw : 'UNSPECIFIED';
  await prisma.user.update({
    where: { id: user.id },
    data: {
      displayName,
      unitSystem: (String(formData.get('unitSystem')) as UnitSystem) === 'IMPERIAL' ? 'IMPERIAL' : 'METRIC',
      timezone,
      sex,
    },
  });
  revalidatePath('/app/settings/account');
  return { notice: t('accountUpdated') };
}

export async function requestEmailChangeAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const t = await getTranslations('authErr');
  const user = await requireUser();
  const parsed = emailSchema.safeParse(formData.get('newEmail'));
  if (!parsed.success) return { error: t('enterEmail') };
  const newEmail = parsed.data;
  if (await prisma.user.findUnique({ where: { email: newEmail } })) return { error: t('emailInUse') };
  await prisma.user.update({ where: { id: user.id }, data: { pendingEmail: newEmail } });
  const { url } = await issueToken('EMAIL_CHANGE', user.id, { payload: { newEmail } });
  // A mail-transport failure must surface as a handled error, not an unhandled 500.
  try {
    await sendMagicLink('EMAIL_CHANGE', newEmail, url);
  } catch (err) {
    logger.error({ err, userId: user.id }, '[account] email-change confirmation failed to send');
    return { error: t('emailChangeSendFailed') };
  }
  return { notice: t('emailChangeSent') };
}
