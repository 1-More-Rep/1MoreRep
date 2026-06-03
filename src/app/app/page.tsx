import Link from 'next/link';
import { requireUser } from '@/lib/auth/guards';
import { getActiveSession, getHistory, sessionVolume } from '@/server/queries/sessions';
import { getStatsBundle } from '@/server/queries/gamification';
import { Card, Mono, SectionLabel, Btn, Ring, Icon } from '@/components/ui';

export const dynamic = 'force-dynamic';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export default async function TodayPage() {
  const user = await requireUser();
  const [active, history, bundle] = await Promise.all([
    getActiveSession(user.id),
    getHistory(user.id, 5),
    getStatsBundle(user.id),
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <div>
        <SectionLabel style={{ marginBottom: 7 }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</SectionLabel>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.05, margin: 0 }}>
          {greeting()},<br />
          {user.displayName}
        </h1>
      </div>

      <Card>
        <SectionLabel style={{ marginBottom: 10 }}>{active ? 'In progress' : "Today's session"}</SectionLabel>
        {active ? (
          <>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{active.name ?? 'Active workout'}</div>
            <Link href="/app/workout/active" style={{ textDecoration: 'none', display: 'block', marginTop: 14 }}>
              <Btn full size="lg" icon="play">Resume workout</Btn>
            </Link>
          </>
        ) : (
          <>
            <div style={{ fontSize: 18, color: 'var(--text-2)' }}>Ready when you are.</div>
            <Link href="/app/workout/new" style={{ textDecoration: 'none', display: 'block', marginTop: 14 }}>
              <Btn full size="lg" icon="play">Start workout</Btn>
            </Link>
          </>
        )}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--gap)' }}>
        <Card style={{ padding: 'calc(var(--pad) * .8)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-text)', marginBottom: 8 }}>
            <Icon name="flame" size={17} stroke={1.9} />
          </div>
          <Mono data-testid="streak-count" style={{ fontSize: 20, fontWeight: 700, display: 'block', lineHeight: 1 }}>{bundle.stats.currentStreak}</Mono>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>day streak</div>
        </Card>
        <Card style={{ padding: 'calc(var(--pad) * .8)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-text)', marginBottom: 8 }}>
            <Icon name="bolt" size={17} stroke={1.9} />
          </div>
          <Mono style={{ fontSize: 20, fontWeight: 700, display: 'block', lineHeight: 1 }}>{bundle.weeklyXp}</Mono>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>XP this week</div>
        </Card>
        <Card style={{ padding: 'calc(var(--pad) * .8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Ring pct={bundle.progress.pct} size={62} stroke={7}>
            <Mono style={{ fontSize: 16, fontWeight: 700 }}>{bundle.progress.level}</Mono>
            <span style={{ fontSize: 8.5, color: 'var(--text-3)' }}>level</span>
          </Ring>
        </Card>
      </div>

      {history.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 2px 12px' }}>
            <SectionLabel>Recent</SectionLabel>
            <Link href="/app/history" style={{ fontSize: 13, color: 'var(--accent-text)', textDecoration: 'none' }}>All</Link>
          </div>
          <Card pad={false}>
            {history.map((s, i) => (
              <Link key={s.id} href={`/app/history/${s.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'var(--row) var(--pad)', borderTop: i ? '1px solid var(--line)' : 'none', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600 }}>{s.name ?? 'Workout'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{s.completedAt?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                </div>
                <Mono style={{ fontSize: 13, color: 'var(--text-3)' }}>{sessionVolume(s.entries).toLocaleString()} kg·reps</Mono>
              </Link>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
