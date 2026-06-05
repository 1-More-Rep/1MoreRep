import Link from 'next/link';
import { getTranslations, getLocale } from 'next-intl/server';
import { requireUser } from '@/lib/auth/guards';
import { exName } from '@/lib/i18n/exercise';
import { prisma } from '@/server/db/prisma';
import { Card, Chip, Mono, SectionLabel } from '@/components/ui';

export const dynamic = 'force-dynamic';

const KIND_LABEL_KEY: Record<string, string> = {
  EST_1RM: 'kindEst1rm',
  BEST_WEIGHT: 'kindTopWeight',
  BEST_VOLUME_SET: 'kindBestSetVolume',
  BEST_REPS: 'kindMostReps',
  BEST_SESSION_VOLUME: 'kindSessionVolume',
};

export default async function PrsPage() {
  const t = await getTranslations('progress');
  const locale = await getLocale();
  const user = await requireUser();
  const prs = await prisma.personalRecord.findMany({
    where: { ownerId: user.id },
    include: { exercise: { select: { name: true, nameDe: true } } },
    orderBy: { achievedAt: 'desc' },
    take: 100,
  });

  // group by exercise (localized display name)
  const byExercise = new Map<string, typeof prs>();
  for (const p of prs) {
    const name = exName(p.exercise, locale);
    const arr = byExercise.get(name) ?? [];
    arr.push(p);
    byExercise.set(name, arr);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <Link href="/app/progress" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← {t('title')}</Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>{t('personalRecords')}</h1>
      {byExercise.size === 0 && <Card soft><span style={{ color: 'var(--text-3)' }}>{t('noPrs')}</span></Card>}
      {[...byExercise.entries()].map(([name, list]) => (
        <Card key={name}>
          <SectionLabel style={{ marginBottom: 10 }}>{name}</SectionLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {list.map((p) => {
              const labelKey = KIND_LABEL_KEY[p.kind];
              return (
                <Chip key={p.id} accent>
                  {labelKey ? t(labelKey) : p.kind} <Mono>{p.value}</Mono> {p.unit}
                </Chip>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}
