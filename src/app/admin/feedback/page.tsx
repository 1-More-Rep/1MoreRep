import { getTranslations } from 'next-intl/server';
import { requireRole } from '@/lib/auth/guards';
import { listAllFeedback } from '@/server/queries/feedback';
import { FeedbackManager, type FeedbackRow } from '@/components/admin/FeedbackManager';
import type { FeedbackCategoryT, FeedbackStatusT } from '@/lib/validation/feedback';

export const dynamic = 'force-dynamic';

export default async function AdminFeedbackPage() {
  await requireRole('ADMIN'); // defense-in-depth (the admin layout also gates this)
  const t = await getTranslations('admin');
  const all = await listAllFeedback();
  const items: FeedbackRow[] = all.map((f) => ({
    id: f.id,
    category: f.category as FeedbackCategoryT,
    status: f.status as FeedbackStatusT,
    message: f.message,
    adminNote: f.adminNote,
    createdAt: f.createdAt.toISOString(),
    user: { displayName: f.user.displayName, publicHandle: f.user.publicHandle },
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{t('feedbackTitle')}</h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-2)', margin: '4px 0 0' }}>{t('feedbackSubtitle')}</p>
      </div>
      <FeedbackManager items={items} />
    </div>
  );
}
