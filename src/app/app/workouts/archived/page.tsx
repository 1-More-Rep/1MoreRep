import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth/guards';
import { listArchivedRoutines } from '@/server/queries/routines';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { SectionLabel } from '@/components/ui';
import { UnarchiveButton } from '@/components/workout/UnarchiveButton';

export const dynamic = 'force-dynamic';

export default async function ArchivedRoutinesPage() {
  const user = await requireUser();
  const t = await getTranslations('routine');
  const archived = await listArchivedRoutines(user.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <Link href="/app/workouts" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← {t('backToWorkouts')}</Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>{t('archivedTitle')}</h1>
      <SectionLabel>{t('archivedIntro')}</SectionLabel>

      {archived.length === 0 && (
        <Card soft><span style={{ color: 'var(--text-3)' }}>{t('nothingArchived')}</span></Card>
      )}

      {archived.map((r) => (
        <Card key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{r.name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 3 }}>
              {t('exercisesCount', { count: r._count.items })}
            </div>
          </div>
          {r.goal && <Chip accent>{r.goal.toLowerCase()}</Chip>}
          <UnarchiveButton routineId={r.id} name={r.name} />
        </Card>
      ))}
    </div>
  );
}
