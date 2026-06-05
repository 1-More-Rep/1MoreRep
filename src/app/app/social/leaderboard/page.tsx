import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth/guards';
import { getBoard, type BoardKey } from '@/server/queries/gamification';
import { Card, Mono, SectionLabel } from '@/components/ui';
import { weightUnit, kgToLb } from '@/domain/units';

export const dynamic = 'force-dynamic';

function Row({ rank, name, value, isSelf, unit, pinned, youSuffix, yourRankSuffix }: { rank: number; name: string; value: number; isSelf: boolean; unit: string; pinned?: boolean; youSuffix: string; yourRankSuffix: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px var(--pad)', borderTop: '1px solid var(--line)', background: isSelf ? 'var(--accent-soft)' : 'transparent' }}>
      <Mono style={{ width: 36, color: rank <= 3 ? 'var(--accent-text)' : 'var(--text-3)', fontWeight: 700 }}>{rank}</Mono>
      <span style={{ flex: 1, fontSize: 14.5, fontWeight: isSelf ? 700 : 500 }}>{name}{isSelf ? ` ${youSuffix}` : ''}{pinned ? ` · ${yourRankSuffix}` : ''}</span>
      <Mono style={{ fontWeight: 600 }}>{value.toLocaleString()}</Mono>
      <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{unit}</span>
    </div>
  );
}

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ board?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const t = await getTranslations('social');

  const TABS: { board: BoardKey; label: string; unit: string; window: string }[] = [
    { board: 'WEEKLY_XP', label: t('boardWeeklyXp'), unit: 'XP', window: t('windowThisWeek') },
    { board: 'ALLTIME_XP', label: t('boardXp'), unit: 'XP', window: t('windowAllTime') },
    { board: 'STREAK', label: t('boardStreak'), unit: t('unitDays'), window: t('windowAllTime') },
    { board: 'VOLUME', label: t('boardVolume'), unit: 'kg·reps', window: t('windowAllTime') },
    { board: 'PR', label: t('boardPrs'), unit: t('unitRecords'), window: t('windowAllTime') },
  ];

  const tab = TABS.find((tabItem) => tabItem.board === sp.board) ?? TABS[0]!;
  const { rows, self } = await getBoard(tab.board, user.id, 50);

  // The VOLUME board stores kg·reps. Render everyone's value in the VIEWER's unit so a
  // shared board never mixes kg and lb across users.
  const isVolume = tab.board === 'VOLUME';
  const dispUnit = isVolume ? `${weightUnit(user.unitSystem)}·reps` : tab.unit;
  const conv = (v: number) => (isVolume && user.unitSystem === 'IMPERIAL' ? Math.round(kgToLb(v)) : v);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <Link href="/app/social" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← {t('title')}</Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>{t('leaderboardsTitle')}</h1>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <Link
            key={t.board}
            href={`/app/social/leaderboard?board=${t.board}`}
            style={{
              padding: '7px 14px',
              borderRadius: 'var(--r-pill)',
              fontSize: 13.5,
              fontWeight: 600,
              textDecoration: 'none',
              background: t.board === tab.board ? 'var(--accent-strong)' : 'var(--surface-2)',
              color: t.board === tab.board ? 'var(--on-accent)' : 'var(--text-2)',
              border: `1px solid ${t.board === tab.board ? 'transparent' : 'var(--line)'}`,
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <SectionLabel>{tab.label} · {tab.window}</SectionLabel>
      <Card pad={false}>
        {rows.length === 0 && <div style={{ padding: 'var(--pad)', color: 'var(--text-3)' }}>{t('leaderboardEmpty')}</div>}
        {rows.map((r) => (
          <Row key={r.rank} rank={r.rank} name={r.name} value={conv(r.value)} isSelf={r.isSelf} unit={dispUnit} youSuffix={t('youSuffix')} yourRankSuffix={t('yourRank')} />
        ))}
        {self && (
          <>
            <div style={{ padding: '4px var(--pad)', borderTop: '1px dashed var(--line-2)', textAlign: 'center', fontSize: 11, color: 'var(--text-3)' }}>⋯</div>
            <Row rank={self.rank} name={user.publicHandle ?? user.displayName} value={conv(self.value)} isSelf unit={dispUnit} pinned youSuffix={t('youSuffix')} yourRankSuffix={t('yourRank')} />
          </>
        )}
      </Card>
    </div>
  );
}
