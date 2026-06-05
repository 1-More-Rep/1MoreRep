import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth/guards';
import { getFeed } from '@/server/social/activity';
import { Card, Icon, Mono, SectionLabel } from '@/components/ui';
import type { IconName } from '@/components/ui';

export const dynamic = 'force-dynamic';

type Translator = Awaited<ReturnType<typeof getTranslations>>;

const VERB_ICON: Record<string, IconName> = {
  WORKOUT_DONE: 'check',
  PR: 'trophy',
  LEVEL_UP: 'arrowUp',
  FRIEND_STREAK: 'flame',
  STREAK_MILESTONE: 'flame',
  LEAGUE_PROMOTE: 'trophy',
};

function verbText(type: string, m: Record<string, unknown>, t: Translator): string {
  switch (type) {
    case 'WORKOUT_DONE':
      return t('feedWorkoutDone');
    case 'PR':
      return t('feedPr', { count: (m.count as number) ?? 1 });
    case 'LEVEL_UP':
      return t('feedLevelUp', { level: m.level as number });
    case 'FRIEND_STREAK':
      return t('feedFriendStreak', { count: m.count as number });
    case 'STREAK_MILESTONE':
      return t('feedStreakMilestone', { count: m.count as number });
    case 'LEAGUE_PROMOTE':
      return t('feedLeaguePromote');
    default:
      return type.toLowerCase();
  }
}

const ago = (d: Date, t: Translator) => {
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 1) return t('agoNow');
  if (m < 60) return t('agoMinutes', { count: m });
  if (m < 1440) return t('agoHours', { count: Math.floor(m / 60) });
  return t('agoDays', { count: Math.floor(m / 1440) });
};

export default async function FeedPage() {
  const user = await requireUser();
  const feed = await getFeed(user.id, 50);
  const t = await getTranslations('social');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <Link href="/app/social" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← {t('title')}</Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>{t('feedTitle')}</h1>
      {feed.length === 0 && <Card soft><span style={{ color: 'var(--text-3)' }}>{t('feedEmpty')}</span></Card>}
      <Card pad={false}>
        {feed.map((e, i) => {
          const icon = VERB_ICON[e.type] ?? ('bolt' as IconName);
          const name = e.user.publicHandle ?? e.user.displayName;
          return (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'var(--row) var(--pad)', borderTop: i ? '1px solid var(--line)' : 'none' }}>
              <span style={{ width: 32, height: 32, borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', color: 'var(--accent-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={icon} size={16} />
              </span>
              <div style={{ flex: 1, fontSize: 14 }}>
                <strong>{name}</strong> {verbText(e.type, (e.meta as Record<string, unknown>) ?? {}, t)}
              </div>
              <Mono style={{ fontSize: 12, color: 'var(--text-3)' }}>{ago(e.createdAt, t)}</Mono>
            </div>
          );
        })}
      </Card>
      <SectionLabel style={{ textAlign: 'center', color: 'var(--text-3)' }}>{t('feedFooter')}</SectionLabel>
    </div>
  );
}
