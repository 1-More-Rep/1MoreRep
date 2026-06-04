import Link from 'next/link';
import { requireUser, hasRole } from '@/lib/auth/guards';
import { getStatsBundle } from '@/server/queries/gamification';
import { openFeedbackCount } from '@/server/queries/feedback';
import { Card, Chip, Mono, Ring, SectionLabel, Btn, Icon } from '@/components/ui';
import type { IconName } from '@/components/ui';

export const dynamic = 'force-dynamic';

const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

const ADMIN_LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: '/admin', label: 'Dashboard', icon: 'chart' },
  { href: '/admin/users', label: 'Users', icon: 'user' },
  { href: '/admin/feedback', label: 'Feedback', icon: 'heart' },
  { href: '/admin/settings', label: 'Settings', icon: 'settings' },
  { href: '/admin/audit', label: 'Audit log', icon: 'history' },
];

export default async function ProfilePage() {
  const user = await requireUser();
  const { stats, progress, tier } = await getStatsBundle(user.id);
  const isAdmin = hasRole(user, 'ADMIN');
  const openFeedback = isAdmin ? await openFeedbackCount() : 0;

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
        <Link href="/app/settings" style={{ textDecoration: 'none' }}><Btn kind="ghost" size="sm" icon="settings">Settings</Btn></Link>
      </div>

      <Card style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <Ring pct={progress.pct} size={104}>
          <Mono style={{ fontSize: 26, fontWeight: 700 }}>{progress.level}</Mono>
          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>level</span>
        </Ring>
        <div style={{ flex: 1 }}>
          <SectionLabel>Progress</SectionLabel>
          <div style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 6 }}>
            <Mono>{progress.intoLevel}</Mono> / <Mono>{progress.forNext}</Mono> XP to level {progress.level + 1}
          </div>
          <div style={{ marginTop: 8 }}><Chip accent>{tier.toLowerCase()} league</Chip></div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap)' }}>
        <Card>
          <SectionLabel>Streak</SectionLabel>
          <Mono style={{ fontSize: 26, fontWeight: 700, display: 'block', marginTop: 6 }}>{stats.currentStreak}</Mono>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>current · longest {stats.longestStreak} · {stats.freezesAvail} freeze{stats.freezesAvail === 1 ? '' : 's'}</div>
        </Card>
        <Card>
          <SectionLabel>Lifetime</SectionLabel>
          <Mono style={{ fontSize: 26, fontWeight: 700, display: 'block', marginTop: 6 }}>{stats.lifetimeXp.toLocaleString()}</Mono>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>XP · {stats.totalSessions} sessions</div>
        </Card>
      </div>

      <Card>
        <SectionLabel>Total volume</SectionLabel>
        <Mono style={{ fontSize: 22, fontWeight: 700, display: 'block', marginTop: 6 }}>{Math.round(Number(stats.totalVolume) / 100).toLocaleString()} kg·reps</Mono>
      </Card>

      <Link href="/app/social" style={{ textDecoration: 'none' }}><Btn kind="soft" full icon="trophy">League &amp; leaderboards</Btn></Link>

      <Btn href="/app/feedback" kind="soft" full icon="heart">Send feedback</Btn>

      {isAdmin && (
        <Card pad={false}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 'var(--pad) var(--pad) 4px' }}>
            <SectionLabel>Admin</SectionLabel>
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
                <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500 }}>{l.label}</span>
                {l.href === '/admin/feedback' && openFeedback > 0 && <Chip accent>{openFeedback} to triage</Chip>}
                <Icon name="chevronR" size={16} stroke={1.8} />
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
