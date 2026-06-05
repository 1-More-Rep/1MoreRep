import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth/guards';
import { getStatsBundle } from '@/server/queries/gamification';
import { Card, Chip, Icon, SectionLabel } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function SocialPage() {
  const user = await requireUser();
  const { tier, weeklyXp } = await getStatsBundle(user.id);
  const t = await getTranslations('social');

  const LINKS = [
    { href: '/app/social/league', icon: 'trophy' as const, title: t('hubLeagueTitle'), desc: t('hubLeagueDesc') },
    { href: '/app/social/leaderboard', icon: 'chart' as const, title: t('hubLeaderboardsTitle'), desc: t('hubLeaderboardsDesc') },
    { href: '/app/profile/friends', icon: 'users' as const, title: t('hubFriendsTitle'), desc: t('hubFriendsDesc') },
    { href: '/app/social/compare', icon: 'target' as const, title: t('hubCompareTitle'), desc: t('hubCompareDesc') },
    { href: '/app/social/feed', icon: 'flame' as const, title: t('hubFeedTitle'), desc: t('hubFeedDesc') },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>{t('title')}</h1>
        <Chip accent>{tier.toLowerCase()} · {weeklyXp} XP</Chip>
      </div>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} style={{ textDecoration: 'none', color: 'inherit' }}>
          <Card style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ width: 40, height: 40, borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', color: 'var(--accent-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={l.icon} size={20} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{l.title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{l.desc}</div>
            </div>
            <Icon name="chevronR" size={18} stroke={1.8} />
          </Card>
        </Link>
      ))}
      <SectionLabel style={{ textAlign: 'center', color: 'var(--text-3)' }}>{t('hubFooter')}</SectionLabel>
    </div>
  );
}
