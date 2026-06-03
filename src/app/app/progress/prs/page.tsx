import Link from 'next/link';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/server/db/prisma';
import { Card, Chip, Mono, SectionLabel } from '@/components/ui';

export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<string, string> = {
  EST_1RM: 'Est. 1RM',
  BEST_WEIGHT: 'Top weight',
  BEST_VOLUME_SET: 'Best set volume',
  BEST_REPS: 'Most reps',
  BEST_SESSION_VOLUME: 'Session volume',
};

export default async function PrsPage() {
  const user = await requireUser();
  const prs = await prisma.personalRecord.findMany({
    where: { ownerId: user.id, kind: { in: ['EST_1RM', 'BEST_WEIGHT'] } },
    include: { exercise: { select: { name: true } } },
    orderBy: { achievedAt: 'desc' },
    take: 100,
  });

  // group by exercise
  const byExercise = new Map<string, typeof prs>();
  for (const p of prs) {
    const arr = byExercise.get(p.exercise.name) ?? [];
    arr.push(p);
    byExercise.set(p.exercise.name, arr);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <Link href="/app/progress" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← Progress</Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Personal records</h1>
      {byExercise.size === 0 && <Card soft><span style={{ color: 'var(--text-3)' }}>No PRs yet — finish a workout to set some.</span></Card>}
      {[...byExercise.entries()].map(([name, list]) => (
        <Card key={name}>
          <SectionLabel style={{ marginBottom: 10 }}>{name}</SectionLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {list.map((p) => (
              <Chip key={p.id} accent>
                {KIND_LABEL[p.kind]} <Mono>{p.value}</Mono> {p.unit}
              </Chip>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
