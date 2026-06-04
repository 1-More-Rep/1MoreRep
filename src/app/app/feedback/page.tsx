import Link from 'next/link';
import { requireUser } from '@/lib/auth/guards';
import { listMyFeedback } from '@/server/queries/feedback';
import { CATEGORY_LABEL, STATUS_LABEL, type FeedbackCategoryT, type FeedbackStatusT } from '@/lib/validation/feedback';
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
  const user = await requireUser();
  const mine = await listMyFeedback(user.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', maxWidth: 620 }}>
      <Link href="/app/profile" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← Profile</Link>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Feedback</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '6px 0 0' }}>
          Found a bug or have an idea? Tell us — the team reviews every submission.
        </p>
      </div>

      <FeedbackForm />

      {mine.length > 0 && (
        <div>
          <SectionLabel style={{ marginBottom: 10 }}>Your submissions ({mine.length})</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mine.map((f) => (
              <Card key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Chip>{CATEGORY_LABEL[f.category as FeedbackCategoryT]}</Chip>
                  <span style={{ fontSize: 12, fontWeight: 700, color: STATUS_COLOR[f.status as FeedbackStatusT] }}>{STATUS_LABEL[f.status as FeedbackStatusT]}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-3)' }}>{f.createdAt.toISOString().slice(0, 10)}</span>
                </div>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-2)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{f.message}</p>
                {f.adminNote && (
                  <div style={{ fontSize: 13, color: 'var(--text-3)', borderLeft: '2px solid var(--accent-line)', paddingLeft: 10, marginTop: 2 }}>
                    <strong style={{ color: 'var(--accent-text)' }}>Team note:</strong> {f.adminNote}
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
