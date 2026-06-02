import Link from 'next/link';
import { prisma } from '@/server/db/prisma';
import { Card } from '@/components/ui/Card';
import { Mono, SectionLabel } from '@/components/ui/typography';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const [users, active, admins, invited, recent] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count({ where: { role: { in: ['ADMIN', 'SUPERADMIN'] } } }),
    prisma.user.count({ where: { status: 'INVITED' } }),
    prisma.auditEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 8, include: { actor: true } }),
  ]);

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
