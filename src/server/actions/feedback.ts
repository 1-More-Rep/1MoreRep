'use server';

import { revalidatePath } from 'next/cache';
import type { FeedbackStatus } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { requireUser, requireRole } from '@/lib/auth/guards';
import { audit } from '@/lib/auth/audit';
import { feedbackSchema, FEEDBACK_STATUSES } from '@/lib/validation/feedback';

export interface FeedbackState {
  error?: string;
  notice?: string;
}

/** Any signed-in user can submit feedback from their profile. */
export async function submitFeedbackAction(_prev: FeedbackState, formData: FormData): Promise<FeedbackState> {
  const user = await requireUser();
  const parsed = feedbackSchema.safeParse({ category: formData.get('category'), message: formData.get('message') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please complete the form.' };

  await prisma.feedback.create({ data: { userId: user.id, category: parsed.data.category, message: parsed.data.message } });
  revalidatePath('/app/feedback');
  return { notice: 'Thanks — your feedback was submitted.' };
}

/** Admins triage feedback by moving it through the status workflow. */
export async function updateFeedbackStatusAction(id: string, status: FeedbackStatus): Promise<void> {
  const actor = await requireRole('ADMIN');
  if (!(FEEDBACK_STATUSES as readonly string[]).includes(status)) return;
  await prisma.feedback.update({ where: { id }, data: { status } });
  await audit({ actorId: actor.id, action: 'feedback.status.update', targetType: 'Feedback', targetId: id, metadata: { status } });
  revalidatePath('/admin/feedback');
}
