import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth/guards';
import { listMyFeedback } from '@/server/queries/feedback';
import { type FeedbackCategoryT, type FeedbackStatusT } from '@/lib/validation/feedback';
import { FeedbackForm } from '@/components/feedback/FeedbackForm';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { SectionLabel } from '@/components/ui/typography';

export const dynamic = 'force-dynamic';

const STATUS_COLOR: Record<FeedbackStatusT, string> = {
  OPEN: 'var(--text-2)',
  IN_PROGRESS: 'var(--accent-text)',
  RESOLVED: 'var(--accent)',
  CLOSED: 'var(--text-3)',
};

export default async function FeedbackPage() {
  const t = await getTranslations('feedback');
  const user = await requireUser();
  const mine = await listMyFeedback(user.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', maxWidth: 620 }}>
      <Link href="/app/profile" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← {t('backToProfile')}</Link>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>{t('pageHeading')}</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '6px 0 0' }}>
          {t('intro')}
        </p>
      </div>

      <FeedbackForm />

      {mine.length > 0 && (
        <div>
          <SectionLabel style={{ marginBottom: 10 }}>{t('yourSubmissionsCount', { count: mine.length })}</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mine.map((f) => (
              <Card key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Chip>{t(`cat.${f.category as FeedbackCategoryT}`)}</Chip>
                  <span style={{ fontSize: 12, fontWeight: 700, color: STATUS_COLOR[f.status as FeedbackStatusT] }}>{t(`status.${f.status as FeedbackStatusT}`)}</span>
                  <time dateTime={f.createdAt.toISOString()} style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-3)' }}>{f.createdAt.toLocaleDateString()}</time>
                </div>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-2)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{f.message}</p>
                {f.adminNote && (
                  <div style={{ fontSize: 13, color: 'var(--text-3)', borderLeft: '2px solid var(--accent-line)', paddingLeft: 10, marginTop: 2 }}>
                    <strong style={{ color: 'var(--accent-text)' }}>{t('teamNote')}:</strong> {f.adminNote}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
