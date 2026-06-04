import 'server-only';
import { prisma } from '@/server/db/prisma';

/** A user's own submitted feedback (most recent first). */
export async function listMyFeedback(userId: string) {
  return prisma.feedback.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
}

/** All feedback for the admin triage screen (open items surface first). */
export async function listAllFeedback() {
  return prisma.feedback.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 300,
    include: { user: { select: { displayName: true, publicHandle: true } } },
  });
}

/** Count of feedback still needing attention (for the admin badge). */
export async function openFeedbackCount(): Promise<number> {
  return prisma.feedback.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } });
}
