import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/guards';
import { getExercise } from '@/server/queries/exercises';
import { MUSCLE_LABEL } from '@/domain/muscles/taxonomy';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Mono, SectionLabel } from '@/components/ui/typography';
import { IconTile, type IconName } from '@/components/ui/Icon';

export const dynamic = 'force-dynamic';

export default async function ExerciseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const ex = await getExercise(id, user.id);
  if (!ex) notFound();

  const links = [...ex.muscleLinks].sort((a, b) => b.weight - a.weight);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <Link href="/app/exercises" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>
        ← Exercises
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <IconTile name={ex.iconKey as IconName} variant="soft" size={52} icon={26} />
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>{ex.name}</h1>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <Chip>{ex.equipment.toLowerCase().replace('_', ' ')}</Chip>
            {ex.mechanic && <Chip>{ex.mechanic.toLowerCase()}</Chip>}
            {ex.level && <Chip>{ex.level}</Chip>}
            {ex.isCustom && <Chip accent>custom</Chip>}
          </div>
        </div>
      </div>

      <Card>
        <SectionLabel style={{ marginBottom: 14 }}>Muscles worked</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {links.map((m) => (
            <div key={m.muscle} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 14, width: 110, color: m.role === 'PRIMARY' ? 'var(--text)' : 'var(--text-2)', fontWeight: m.role === 'PRIMARY' ? 600 : 500 }}>
                {MUSCLE_LABEL[m.muscle]}
              </span>
              <div style={{ flex: 1, height: 8, background: 'var(--surface-2)', borderRadius: 'var(--r-pill)', overflow: 'hidden' }}>
                <div style={{ width: `${Math.round(m.weight * 100)}%`, height: '100%', background: 'var(--accent)', borderRadius: 'var(--r-pill)' }} />
              </div>
              <Mono style={{ fontSize: 12, color: 'var(--text-3)', width: 34, textAlign: 'right' }}>{m.weight.toFixed(1)}</Mono>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionLabel style={{ marginBottom: 14 }}>Default scheme</SectionLabel>
        <div style={{ display: 'flex', gap: 20 }}>
          <div><Mono style={{ fontSize: 18, fontWeight: 700 }}>{ex.defaultSets} × {ex.defaultRepLow}–{ex.defaultRepHigh}</Mono><div style={{ fontSize: 12, color: 'var(--text-3)' }}>sets × reps</div></div>
          <div><Mono style={{ fontSize: 18, fontWeight: 700 }}>{ex.defaultRestSec}s</Mono><div style={{ fontSize: 12, color: 'var(--text-3)' }}>rest</div></div>
        </div>
      </Card>

      {ex.instructions.length > 0 && (
        <Card>
          <SectionLabel style={{ marginBottom: 14 }}>Instructions</SectionLabel>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ex.instructions.map((step, i) => (
              <li key={i} style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-2)' }}>{step}</li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
