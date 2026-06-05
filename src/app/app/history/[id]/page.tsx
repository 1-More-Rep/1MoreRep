import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth/guards';
import { getSessionDetail, sessionVolume, completedSetCount } from '@/server/queries/sessions';
import { prisma } from '@/server/db/prisma';
import { repeatWorkoutAction } from '@/server/actions/workout';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Btn } from '@/components/ui/Btn';
import { Mono, SectionLabel } from '@/components/ui/typography';
import { IconTile, type IconName } from '@/components/ui/Icon';
import { formatWeight, weightUnit, kgToLb } from '@/domain/units';

export const dynamic = 'force-dynamic';

const PR_LABEL_KEY: Record<string, string> = {
  EST_1RM: 'prEst1rm',
  BEST_WEIGHT: 'prTopWeight',
  BEST_VOLUME_SET: 'prSetVolume',
  BEST_REPS: 'prReps',
  BEST_SESSION_VOLUME: 'prSessionVolume',
};

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations('history');
  const user = await requireUser();
  const { id } = await params;
  const session = await getSessionDetail(id, user.id);
  if (!session) notFound();
  const prs = await prisma.personalRecord.findMany({ where: { sessionId: id }, include: { exercise: { select: { name: true } } } });
  const entries = session.entries.filter((e) => !e.isRemoved);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <Link href="/app/history" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← {t('title')}</Link>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 auto' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>{session.name ?? t('workout')}</h1>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <Chip><Mono>{completedSetCount(entries)}</Mono>&nbsp;{t('sets')}</Chip>
            <Chip><Mono>{Math.round(user.unitSystem === 'IMPERIAL' ? kgToLb(sessionVolume(entries)) : sessionVolume(entries)).toLocaleString()}</Mono>&nbsp;{weightUnit(user.unitSystem)}·{t('reps')}</Chip>
            {session.durationSec != null && <Chip><Mono>{Math.round(session.durationSec / 60)}m</Mono></Chip>}
          </div>
        </div>
        <form action={repeatWorkoutAction.bind(null, session.id)}>
          <Btn type="submit" icon="play">{t('repeat')}</Btn>
        </form>
      </div>

      {session.notes && (
        <Card>
          <SectionLabel style={{ marginBottom: 8 }}>{t('notes')}</SectionLabel>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-2)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{session.notes}</p>
        </Card>
      )}

      {prs.length > 0 && (
        <Card style={{ borderColor: 'var(--accent-line)' }}>
          <SectionLabel style={{ marginBottom: 10 }}>{t('newPRs')} 🎉</SectionLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {prs.map((p) => (
              <Chip key={p.id} accent>
                {p.exercise.name}: {PR_LABEL_KEY[p.kind] ? t(PR_LABEL_KEY[p.kind]!) : p.kind} <Mono>{p.value}</Mono>
              </Chip>
            ))}
          </div>
        </Card>
      )}

      {entries.map((e) => (
        <Card key={e.id} pad={false}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'var(--pad)' }}>
            <IconTile name={e.exercise.iconKey as IconName} variant="soft" size={38} icon={19} />
            <div style={{ fontSize: 15, fontWeight: 600 }}>{e.exercise.name}</div>
          </div>
          <div>
            {e.sets.filter((s) => s.completed).map((s) => (
              <div key={s.setIndex} style={{ display: 'flex', gap: 16, padding: '8px var(--pad)', borderTop: '1px solid var(--line)', fontSize: 13.5 }}>
                <Mono style={{ color: 'var(--text-3)', width: 24 }}>{s.setIndex}</Mono>
                <Mono>{s.weightKg == null ? '—' : `${formatWeight(s.weightKg, user.unitSystem)} ${weightUnit(user.unitSystem)}`}</Mono>
                <Mono>{s.reps ?? '—'} {t('reps')}</Mono>
                {s.rpe != null && <Mono style={{ color: 'var(--text-3)' }}>RPE {s.rpe}</Mono>}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
