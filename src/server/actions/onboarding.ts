'use server';

import { redirect } from 'next/navigation';
import type { UnitSystem } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { requireUser } from '@/lib/auth/guards';

export async function completeOnboardingAction(data: { timezone: string; unitSystem: UnitSystem }): Promise<void> {
  const user = await requireUser();
  // basic timezone validation via Intl
  let tz = 'UTC';
  try {
    Intl.DateTimeFormat(undefined, { timeZone: data.timezone });
    tz = data.timezone;
  } catch {
    tz = 'UTC';
  }
  await prisma.user.update({ where: { id: user.id }, data: { timezone: tz, unitSystem: data.unitSystem === 'IMPERIAL' ? 'IMPERIAL' : 'METRIC' } });
  redirect('/app/workout/generate');
}
