'use server';

import { revalidatePath } from 'next/cache';
import type { Muscle } from '@prisma/client';
import { requireUser } from '@/lib/auth/guards';
import { reportSoreness } from '@/server/services/fatigueService';

export async function reportSorenessAction(muscle: Muscle, severity: number): Promise<void> {
  const user = await requireUser();
  await reportSoreness(user.id, muscle, severity);
  revalidatePath('/app/muscle');
}
