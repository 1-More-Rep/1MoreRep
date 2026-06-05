import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireUser, hasRole } from '@/lib/auth/guards';
import { getStatsBundle } from '@/server/queries/gamification';
import { openFeedbackCount } from '@/server/queries/feedback';
import { countPendingRequests } from '@/server/social/friends';
import { Card, Chip, Mono, Ring, SectionLabel, Btn, Icon } from '@/components/ui';
import type { IconName } from '@/components/ui';

export const dynamic = 'force-dynamic';

const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

const ADMIN_LINKS: { href: string; labelKey: string; icon: IconName }[] = [
  { href: '/admin', labelKey: 'adminDashboard', icon: 'chart' },
  { href: '/admin/users', labelKey: 'adminUsers', icon: 'user' },
  { href: '/admin/feedback', labelKey: 'adminFeedback', icon: 'megaphone' },
  { href: '/admin/settings', labelKey: 'adminSettings', icon: 'settings' },
  { href: '/admin/audit', labelKey: 'adminAuditLog', icon: 'history' },
];

/** A tappable row in the Profile hub menu. */
function HubRow({
  href,
  icon,
  label,
  badge,
  first,
}: {
  href: string;
  icon: IconName;
  label: string;
  badge?: number;
  first?: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        minHeight: 56,
        padding: '10px var(--pad)',
        textDecoration: 'none',
        color: 'var(--text)',
        borderTop: first ? 'none' : '1px solid var(--line)',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 34,
          height: 34,
          borderRadius: 'var(--r-sm)',
          background: 'var(--surface-2)',
          color: 'var(--accent-text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size={18} stroke={1.9} />
      </span>
      <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{label}</span>
      {badge ? <Chip accent>{badge}</Chip> : null}
      <Icon name="chevronR" size={16} stroke={1.8} style={{ color: 'var(--text-3)' }} />
    </Link>
  );
}

export default async function ProfilePage() {
  const t = await getTranslations('profile');
  const user = await requireUser();
  const { stats, progress, tier } = await getStatsBundle(user.id);
  const isAdmin = hasRole(user, 'ADMIN');
  const [openFeedback, pendingFriends] = await Promise.all([
    isAdmin ? openFeedbackCount() : Promise.resolve(0),
    countPendingRequests(user.id),
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 56, height: 56, borderRadius: 'var(--r-pill)', background: 'var(--surface-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-2)' }}>
          {initials(user.displayName)}
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>{user.displayName}</h1>
          {user.publicHandle && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>@{user.publicHandle}</div>}
        </div>
        <Link href="/app/settings" style={{ textDecoration: 'none' }}><Btn kind="ghost" size="sm" icon="settings">{t('settings')}</Btn></Link>
      </div>

      <Card style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <Ring pct={progress.pct} size={104}>
          <Mono style={{ fontSize: 26, fontWeight: 700 }}>{progress.level}</Mono>
          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{t('level')}</span>
        </Ring>
        <div style={{ flex: 1 }}>
          <SectionLabel>{t('progress')}</SectionLabel>
          <div style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 6 }}>
            <Mono>{progress.intoLevel}</Mono> / <Mono>{progress.forNext}</Mono> {t('xpToLevel', { level: progress.level + 1 })}
          </div>
          <div style={{ marginTop: 8 }}><Chip accent>{t('leagueChip', { tier: tier.toLowerCase() })}</Chip></div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap)' }}>
        <Card>
          <SectionLabel>{t('streak')}</SectionLabel>
          <Mono style={{ fontSize: 26, fontWeight: 700, display: 'block', marginTop: 6 }}>{stats.currentStreak}</Mono>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{t('streakMeta', { longest: stats.longestStreak, freezes: stats.freezesAvail })}</div>
        </Card>
        <Card>
          <SectionLabel>{t('lifetime')}</SectionLabel>
          <Mono style={{ fontSize: 26, fontWeight: 700, display: 'block', marginTop: 6 }}>{stats.lifetimeXp.toLocaleString()}</Mono>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{t('lifetimeMeta', { sessions: stats.totalSessions })}</div>
        </Card>
      </div>

      <Card>
        <SectionLabel>{t('totalVolume')}</SectionLabel>
        <Mono style={{ fontSize: 22, fontWeight: 700, display: 'block', marginTop: 6 }}>{t('volumeValue', { value: Math.round(Number(stats.totalVolume) / 100).toLocaleString() })}</Mono>
      </Card>

      <Card pad={false}>
        <HubRow first href="/app/profile/friends" icon="users" label={t('friends')} badge={pendingFriends || undefined} />
        <HubRow href="/app/social" icon="trophy" label={t('leagueLeaderboards')} />
        <HubRow href="/app/muscle" icon="heart" label={t('muscleMap')} />
        <HubRow href="/app/feedback" icon="megaphone" label={t('helpFeedback')} />
        <HubRow href="/app/settings" icon="settings" label={t('settings')} />
      </Card>

      {isAdmin && (
        <Card pad={false}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 'var(--pad) var(--pad) 4px' }}>
            <SectionLabel>{t('admin')}</SectionLabel>
            <Chip accent style={{ marginLeft: 'auto' }}>{user.role.toLowerCase()}</Chip>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {ADMIN_LINKS.map((l, i) => (
              <Link
                key={l.href}
                href={l.href}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px var(--pad)', textDecoration: 'none', color: 'var(--text)', borderTop: i ? '1px solid var(--line)' : '1px solid var(--line)', marginTop: i ? 0 : 6 }}
              >
                <span style={{ width: 30, height: 30, borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', color: 'var(--accent-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={l.icon} size={16} stroke={1.8} />
                </span>
                <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500 }}>{t(l.labelKey)}</span>
                {l.href === '/admin/feedback' && openFeedback > 0 && <Chip accent>{t('toTriage', { count: openFeedback })}</Chip>}
                <Icon name="chevronR" size={16} stroke={1.8} />
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
