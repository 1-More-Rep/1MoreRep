import { prisma } from '@/server/db/prisma';
import { Card } from '@/components/ui/Card';
import { Mono } from '@/components/ui/typography';

export const dynamic = 'force-dynamic';

export default async function AdminAuditPage() {
  const events = await prisma.auditEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: { actor: true } });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Audit log</h1>
      <Card pad={false}>
        {events.length === 0 && <div style={{ padding: 'var(--pad)', color: 'var(--text-3)' }}>No events.</div>}
        {events.map((e, i) => (
          <div
            key={e.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px var(--pad)',
              borderTop: i ? '1px solid var(--line)' : 'none',
              fontSize: 13.5,
            }}
          >
            <Mono style={{ color: 'var(--text-3)', fontSize: 12, minWidth: 130 }}>
              {e.createdAt.toISOString().slice(0, 19).replace('T', ' ')}
            </Mono>
            <Mono style={{ fontWeight: 600, minWidth: 160 }}>{e.action}</Mono>
            <span style={{ color: 'var(--text-2)' }}>{e.actor ? e.actor.displayName : 'system'}</span>
            {e.targetId && <span style={{ color: 'var(--text-3)', marginLeft: 'auto', fontSize: 12 }}>{e.targetType}:{e.targetId.slice(0, 8)}</span>}
          </div>
        ))}
      </Card>
    </div>
  );
}
