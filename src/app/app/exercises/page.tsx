import Link from 'next/link';
import { requireUser } from '@/lib/auth/guards';
import { searchExercises } from '@/server/queries/exercises';
import { MUSCLE_LABEL } from '@/domain/muscles/taxonomy';
import type { Muscle, Equipment } from '@prisma/client';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Btn } from '@/components/ui/Btn';
import { IconTile } from '@/components/ui/Icon';
import { SectionLabel } from '@/components/ui/typography';
import { ExerciseFilters } from '@/components/exercises/ExerciseFilters';
import type { IconName } from '@/components/ui/Icon';

export const dynamic = 'force-dynamic';

export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; muscle?: string; equipment?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const results = await searchExercises({
    q: sp.q,
    muscle: sp.muscle as Muscle | undefined,
    equipment: sp.equipment as Equipment | undefined,
    userId: user.id,
    take: 80,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Exercises</h1>
        <Link href="/app/exercises/new" style={{ textDecoration: 'none' }}>
          <Btn icon="plus" size="sm">New exercise</Btn>
        </Link>
      </div>

      <ExerciseFilters />

      <SectionLabel>{results.length} result{results.length === 1 ? '' : 's'}</SectionLabel>

      <Card pad={false}>
        {results.length === 0 && <div style={{ padding: 'var(--pad)', color: 'var(--text-3)' }}>No matching exercises.</div>}
        {results.map((ex, i) => {
          const primaries = ex.muscleLinks.filter((m) => m.role === 'PRIMARY').map((m) => MUSCLE_LABEL[m.muscle]);
          return (
            <Link
              key={ex.id}
              href={`/app/exercises/${ex.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 'var(--row) var(--pad)',
                borderTop: i ? '1px solid var(--line)' : 'none',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <IconTile name={ex.iconKey as IconName} variant="soft" size={40} icon={20} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-.01em' }}>{ex.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{primaries.join(' · ') || '—'}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {ex.isCustom && <Chip accent>custom</Chip>}
                <Chip>{ex.equipment.toLowerCase().replace('_', ' ')}</Chip>
              </div>
            </Link>
          );
        })}
      </Card>
    </div>
  );
}
