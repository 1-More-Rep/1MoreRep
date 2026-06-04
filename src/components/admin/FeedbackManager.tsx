'use client';

import { useState, useTransition } from 'react';
import type { FeedbackStatus } from '@prisma/client';
import { updateFeedbackStatusAction } from '@/server/actions/feedback';
import { CATEGORY_LABEL, STATUS_LABEL, FEEDBACK_STATUSES, type FeedbackCategoryT, type FeedbackStatusT } from '@/lib/validation/feedback';
import { Card } from '@/components/ui/Card';
import { Btn } from '@/components/ui/Btn';
import { Chip } from '@/components/ui/Chip';
import { SectionLabel } from '@/components/ui/typography';

export interface FeedbackRow {
  id: string;
  category: FeedbackCategoryT;
  status: FeedbackStatusT;
  message: string;
  createdAt: string;
  user: { displayName: string; publicHandle: string | null };
}

const STATUS_COLOR: Record<FeedbackStatusT, string> = {
  OPEN: 'var(--text-2)',
  IN_PROGRESS: 'var(--accent-text)',
  RESOLVED: 'var(--accent)',
  CLOSED: 'var(--text-3)',
};

const FILTERS = ['ALL', ...FEEDBACK_STATUSES] as const;

const selectStyle: React.CSSProperties = {
  height: 36,
  padding: '0 10px',
  borderRadius: 'var(--r-sm)',
  border: '1px solid var(--line-2)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'var(--font-sans)',
};

export function FeedbackManager({ items }: { items: FeedbackRow[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL');
  const [, start] = useTransition();
  const [rows, setRows] = useState(items);

  const shown = filter === 'ALL' ? rows : rows.filter((r) => r.status === filter);

  function setStatus(id: string, status: FeedbackStatusT) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    start(() => updateFeedbackStatusAction(id, status as FeedbackStatus));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <Btn key={f} kind={filter === f ? 'primary' : 'soft'} size="sm" onClick={() => setFilter(f)}>
            {f === 'ALL' ? 'All' : STATUS_LABEL[f]} {f === 'ALL' ? `(${rows.length})` : `(${rows.filter((r) => r.status === f).length})`}
          </Btn>
        ))}
      </div>

      {shown.length === 0 && <Card soft><span style={{ color: 'var(--text-3)' }}>No feedback in this view.</span></Card>}

      {shown.map((f) => (
        <Card key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Chip accent>{CATEGORY_LABEL[f.category]}</Chip>
            <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
              {f.user.displayName}{f.user.publicHandle ? ` · @${f.user.publicHandle}` : ''}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-3)' }}>{f.createdAt.slice(0, 10)}</span>
          </div>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{f.message}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SectionLabel>Status</SectionLabel>
            <span style={{ fontSize: 12, fontWeight: 700, color: STATUS_COLOR[f.status] }}>{STATUS_LABEL[f.status]}</span>
            <select aria-label={`Set status for feedback from ${f.user.displayName}`} value={f.status} onChange={(e) => setStatus(f.id, e.target.value as FeedbackStatusT)} style={{ ...selectStyle, marginLeft: 'auto' }}>
              {FEEDBACK_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
        </Card>
      ))}
    </div>
  );
}
