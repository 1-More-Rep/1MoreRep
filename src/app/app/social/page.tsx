import Link from 'next/link';
import { requireUser } from '@/lib/auth/guards';
import { getStatsBundle } from '@/server/queries/gamification';
import { Card, Chip, Icon, SectionLabel } from '@/components/ui';

export const dynamic = 'force-dynamic';

const LINKS = [
  { href: '/app/social/league', icon: 'trophy' as const, title: 'League', desc: 'Your weekly division and standings' },
  { href: '/app/social/leaderboard', icon: 'chart' as const, title: 'Leaderboards', desc: 'Instance-wide XP, streak and volume' },
  { href: '/app/social/friends', icon: 'user' as const, title: 'Friends', desc: 'Add friends and compare progress' },
  { href: '/app/social/compare', icon: 'target' as const, title: 'Compare', desc: 'Stack your stats next to a friend' },
  { href: '/app/social/feed', icon: 'flame' as const, title: 'Friend activity', desc: 'PRs, streaks and milestones' },
];

export default async function SocialPage() {
  const user = await requireUser();
  const { tier, weeklyXp } = await getStatsBundle(user.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Social</h1>
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
      <SectionLabel style={{ textAlign: 'center', color: 'var(--text-3)' }}>Train daily to climb your league.</SectionLabel>
    </div>
  );
}
