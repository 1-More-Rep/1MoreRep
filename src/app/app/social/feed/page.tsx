import Link from 'next/link';
import { requireUser } from '@/lib/auth/guards';
import { getFeed } from '@/server/social/activity';
import { Card, Icon, Mono, SectionLabel } from '@/components/ui';
import type { IconName } from '@/components/ui';

export const dynamic = 'force-dynamic';

const VERB: Record<string, { text: (m: Record<string, unknown>) => string; icon: IconName }> = {
  WORKOUT_DONE: { text: () => 'completed a workout', icon: 'check' },
  PR: { text: (m) => `hit ${(m.count as number) ?? 1} new PR${(m.count as number) > 1 ? 's' : ''}`, icon: 'trophy' },
  LEVEL_UP: { text: (m) => `reached level ${m.level}`, icon: 'arrowUp' },
  FRIEND_STREAK: { text: (m) => `kept a ${m.count}-day friend streak`, icon: 'flame' },
  STREAK_MILESTONE: { text: (m) => `hit a ${m.count}-day streak`, icon: 'flame' },
  LEAGUE_PROMOTE: { text: () => 'was promoted in their league', icon: 'trophy' },
};

const ago = (d: Date) => {
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
};

export default async function FeedPage() {
  const user = await requireUser();
  const feed = await getFeed(user.id, 50);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <Link href="/app/social" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← Social</Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Friend activity</h1>
      {feed.length === 0 && <Card soft><span style={{ color: 'var(--text-3)' }}>No friend activity yet. Add friends to see their progress.</span></Card>}
      <Card pad={false}>
        {feed.map((e, i) => {
          const v = VERB[e.type] ?? { text: () => e.type.toLowerCase(), icon: 'bolt' as IconName };
          const name = e.user.publicHandle ?? e.user.displayName;
          return (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'var(--row) var(--pad)', borderTop: i ? '1px solid var(--line)' : 'none' }}>
              <span style={{ width: 32, height: 32, borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', color: 'var(--accent-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={v.icon} size={16} />
              </span>
              <div style={{ flex: 1, fontSize: 14 }}>
                <strong>{name}</strong> {v.text((e.meta as Record<string, unknown>) ?? {})}
              </div>
              <Mono style={{ fontSize: 12, color: 'var(--text-3)' }}>{ago(e.createdAt)}</Mono>
            </div>
          );
        })}
      </Card>
      <SectionLabel style={{ textAlign: 'center', color: 'var(--text-3)' }}>Only friends&apos; activity is shown.</SectionLabel>
    </div>
  );
}
