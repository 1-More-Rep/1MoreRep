import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/server/db/prisma';
import { getPrivacy, canView } from '@/server/social/privacy';
import { friendshipStatus } from '@/server/social/friends';
import { levelProgress } from '@/domain/gamification/xp';
import { Btn, Card, Chip, Mono, Ring, SectionLabel } from '@/components/ui';
import { ProfileFriendButton } from '@/components/social/ProfileFriendButton';

export const dynamic = 'force-dynamic';

const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

export default async function PublicProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const viewer = await requireUser();
  const { handle } = await params;
  const t = await getTranslations('social');
  const target = await prisma.user.findUnique({
    where: { publicHandle: handle },
    select: { id: true, displayName: true, publicHandle: true, status: true, stats: true },
  });
  if (!target || target.status !== 'ACTIVE') notFound();

  const privacy = await getPrivacy(target.id);
  const status = await friendshipStatus(viewer.id, target.id);
  const canStats = await canView(viewer.id, target.id, privacy.showStats);
  const progress = target.stats ? levelProgress(target.stats.lifetimeXp) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 56, height: 56, borderRadius: 'var(--r-pill)', background: 'var(--surface-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-2)' }}>
          {initials(target.displayName)}
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{target.displayName}</h1>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>@{target.publicHandle}</div>
        </div>
        {status !== 'SELF' && <ProfileFriendButton handle={target.publicHandle!} userId={target.id} status={status} />}
      </div>

      {status === 'ACCEPTED' && target.publicHandle && (
        <Btn href={`/app/social/compare?with=${encodeURIComponent(target.publicHandle)}`} kind="soft" icon="target" style={{ alignSelf: 'flex-start' }}>
          {t('profileCompareStats')}
        </Btn>
      )}

      {canStats && progress && target.stats ? (
        <>
          <Card style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <Ring pct={progress.pct} size={88}>
              <Mono style={{ fontSize: 22, fontWeight: 700 }}>{progress.level}</Mono>
              <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{t('profileLevel')}</span>
            </Ring>
            <div>
              <Chip accent>{t('profileLeague', { tier: target.stats.leagueTier.toLowerCase() })}</Chip>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 8 }}>
                <Mono>{target.stats.currentStreak}</Mono> {t('profileDayStreak')} · <Mono>{target.stats.totalSessions}</Mono> {t('profileSessions')}
              </div>
            </div>
          </Card>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap)' }}>
            <Card><SectionLabel>{t('metricLifetimeXp')}</SectionLabel><Mono style={{ fontSize: 22, fontWeight: 700, display: 'block', marginTop: 6 }}>{target.stats.lifetimeXp.toLocaleString()}</Mono></Card>
            <Card><SectionLabel>{t('profileLongestStreak')}</SectionLabel><Mono style={{ fontSize: 22, fontWeight: 700, display: 'block', marginTop: 6 }}>{target.stats.longestStreak}</Mono></Card>
          </div>
        </>
      ) : (
        <Card soft><span style={{ color: 'var(--text-3)' }}>{t('profilePrivate')} {status === 'NONE' ? t('profilePrivateAddFriend') : ''}</span></Card>
      )}
    </div>
  );
}
