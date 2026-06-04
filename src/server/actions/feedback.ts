'use server';

import { revalidatePath } from 'next/cache';
import type { FeedbackStatus, Prisma } from '@prisma/client';
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

export interface FeedbackPatch {
  status?: FeedbackStatus;
  adminNote?: string | null;
}

/**
 * Admins triage feedback: change status and/or leave a team note (shown back to
 * the submitter). Returns { ok } so the client can reconcile its optimistic state;
 * a concurrently-deleted row is a benign no-op (updateMany never throws P2025).
 */
export async function updateFeedbackAction(id: string, patch: FeedbackPatch): Promise<{ ok: boolean }> {
  const actor = await requireRole('ADMIN');
  const data: Prisma.FeedbackUpdateManyMutationInput = {};
  if (patch.status !== undefined) {
    if (!(FEEDBACK_STATUSES as readonly string[]).includes(patch.status)) return { ok: false };
    data.status = patch.status;
  }
  if (patch.adminNote !== undefined) {
    const note = patch.adminNote?.trim();
    data.adminNote = note ? note.slice(0, 2000) : null;
  }
  if (Object.keys(data).length === 0) return { ok: true };

  const res = await prisma.feedback.updateMany({ where: { id }, data });
  if (res.count === 0) return { ok: false }; // already deleted — nothing to do

  await audit({
    actorId: actor.id,
    action: 'feedback.update',
    targetType: 'Feedback',
    targetId: id,
    metadata: { ...(patch.status ? { status: patch.status } : {}), noteChanged: patch.adminNote !== undefined },
  });
  revalidatePath('/admin/feedback');
  revalidatePath('/app/feedback');
  return { ok: true };
}
