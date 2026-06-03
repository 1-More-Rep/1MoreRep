import Link from 'next/link';
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
    { label: 'Users', value: users },
    { label: 'Active', value: active },
    { label: 'Admins', value: admins },
    { label: 'Pending invites', value: invited },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Dashboard</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--gap)' }}>
        {stats.map((s) => (
          <Card key={s.label}>
            <SectionLabel>{s.label}</SectionLabel>
            <Mono style={{ fontSize: 28, fontWeight: 700, display: 'block', marginTop: 6 }}>{s.value}</Mono>
          </Card>
        ))}
      </div>
      <Card>
        <SectionLabel style={{ marginBottom: 12 }}>Background jobs</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {jobs.map(({ job, run, overdue }) => {
            const status = run?.status ?? 'NONE';
            const color = status === 'FAILED' ? '#c0392b' : status === 'OK' ? 'var(--accent-text)' : 'var(--text-3)';
            return (
              <div key={job} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'var(--text-2)' }}>
                <Mono style={{ flex: 1 }}>{job}</Mono>
                {overdue && run && <Chip style={{ color: '#b06a00' }}>overdue</Chip>}
                <span style={{ color, fontWeight: 600 }}>{status === 'NONE' ? 'never run' : status}</span>
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
          <SectionLabel>Recent activity</SectionLabel>
          <Link href="/admin/audit" style={{ fontSize: 13, color: 'var(--accent-text)', textDecoration: 'none' }}>
            View all
          </Link>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recent.length === 0 && <span style={{ fontSize: 14, color: 'var(--text-3)' }}>No activity yet.</span>}
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
