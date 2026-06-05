import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/server/db/prisma';
import { JOB_NAMES } from '@/server/jobs';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Mono, SectionLabel } from '@/components/ui/typography';

export const dynamic = 'force-dynamic';

// Expected cadence per job (minutes) — a run older than ~2× this is "overdue".
const JOB_CADENCE_MIN: Record<string, number> = {
  'streak.rollover': 60,
  'league.settle': 60 * 24 * 7,
  'leaderboard.refresh': 10,
  'streak.risk.notify': 60,
};

export default async function AdminDashboard() {
  const t = await getTranslations('admin');
  const [users, active, admins, invited, recent, jobRuns] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count({ where: { role: { in: ['ADMIN', 'SUPERADMIN'] } } }),
    prisma.user.count({ where: { status: 'INVITED' } }),
    prisma.auditEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 8, include: { actor: true } }),
    Promise.all(JOB_NAMES.map((job) => prisma.jobRun.findFirst({ where: { job }, orderBy: { startedAt: 'desc' } }))),
  ]);

  const now = Date.now();
  const jobs = JOB_NAMES.map((job, i) => {
    const run = jobRuns[i];
    const ageMin = run ? (now - run.startedAt.getTime()) / 60000 : Infinity;
    const overdue = ageMin > (JOB_CADENCE_MIN[job] ?? 60) * 2;
    return { job, run, overdue };
  });

  const stats = [
    { label: t('statUsers'), value: users },
    { label: t('statActive'), value: active },
    { label: t('statAdmins'), value: admins },
    { label: t('statPendingInvites'), value: invited },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{t('dashboardTitle')}</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--gap)' }}>
        {stats.map((s) => (
          <Card key={s.label}>
            <SectionLabel>{s.label}</SectionLabel>
            <Mono style={{ fontSize: 28, fontWeight: 700, display: 'block', marginTop: 6 }}>{s.value}</Mono>
          </Card>
        ))}
      </div>
      <Card>
        <SectionLabel style={{ marginBottom: 12 }}>{t('backgroundJobs')}</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {jobs.map(({ job, run, overdue }) => {
            const status = run?.status ?? 'NONE';
            const color = status === 'FAILED' ? '#c0392b' : status === 'OK' ? 'var(--accent-text)' : 'var(--text-3)';
            return (
              <div key={job} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'var(--text-2)' }}>
                <Mono style={{ flex: 1 }}>{job}</Mono>
                {/* Warn whenever a job is overdue — including a job that has NEVER run,
                    which is the loudest possible signal that the cron sidecar isn't wired
                    up. Previously `&& run` suppressed the badge in exactly that case. */}
                {overdue && <Chip style={{ color: '#8a5200' }}>{run ? t('jobOverdue') : t('jobNeverRunCheckCron')}</Chip>}
                <span style={{ color, fontWeight: 600 }}>{status === 'NONE' ? t('jobNeverRun') : status}</span>
                <Mono style={{ color: 'var(--text-3)', fontSize: 12, width: 96, textAlign: 'right' }}>
                  {run ? (run.finishedAt ?? run.startedAt).toISOString().slice(0, 16).replace('T', ' ') : '—'}
                </Mono>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <SectionLabel>{t('recentActivity')}</SectionLabel>
          <Link href="/admin/audit" style={{ fontSize: 13, color: 'var(--accent-text)', textDecoration: 'none' }}>
            {t('viewAll')}
          </Link>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recent.length === 0 && <span style={{ fontSize: 14, color: 'var(--text-3)' }}>{t('noActivityYet')}</span>}
          {recent.map((e) => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: 'var(--text-2)' }}>
              <span>
                <Mono>{e.action}</Mono>
                {e.actor ? ` · ${e.actor.displayName}` : ''}
              </span>
              <Mono style={{ color: 'var(--text-3)', fontSize: 12 }}>{e.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</Mono>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
