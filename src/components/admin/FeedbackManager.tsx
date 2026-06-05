'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { FeedbackStatus } from '@prisma/client';
import { updateFeedbackAction, type FeedbackPatch } from '@/server/actions/feedback';
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
  adminNote: string | null;
  createdAt: string;
  user: { displayName: string; publicHandle: string | null };
}

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

const STATUS_COLOR: Record<FeedbackStatusT, string> = {
  OPEN: 'var(--text-2)',
  IN_PROGRESS: 'var(--accent-text)',
  RESOLVED: 'var(--accent)',
  CLOSED: 'var(--text-3)',
};

const FILTERS = ['ALL', ...FEEDBACK_STATUSES] as const;

const fieldStyle: React.CSSProperties = {
  borderRadius: 'var(--r-sm)',
  border: '1px solid var(--line-2)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'var(--font-sans)',
};

export function FeedbackManager({ items }: { items: FeedbackRow[] }) {
  const t = useTranslations('admin');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL');
  const [rows, setRows] = useState(items);
  const [save, setSave] = useState<Record<string, SaveState>>({});
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const shown = filter === 'ALL' ? rows : rows.filter((r) => r.status === filter);

  async function apply(id: string, patch: FeedbackPatch) {
    const prev = rows.find((r) => r.id === id);
    if (!prev) return;
    setRows((p) => p.map((r) => (r.id === id ? { ...r, ...(patch.status ? { status: patch.status as FeedbackStatusT } : {}), ...(patch.adminNote !== undefined ? { adminNote: patch.adminNote } : {}) } : r)));
    setSave((s) => ({ ...s, [id]: 'saving' }));
    try {
      const res = await updateFeedbackAction(id, patch);
      if (!res.ok) throw new Error('update failed');
      setSave((s) => ({ ...s, [id]: 'saved' }));
      setTimeout(() => setSave((s) => ({ ...s, [id]: 'idle' })), 1600);
    } catch {
      setRows((p) => p.map((r) => (r.id === id ? prev : r))); // revert optimistic change
      setSave((s) => ({ ...s, [id]: 'failed' }));
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <div role="group" aria-label={t('filterByStatus')} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <Btn key={f} kind={filter === f ? 'primary' : 'soft'} size="sm" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === 'ALL' ? t('filterAll') : STATUS_LABEL[f]} ({f === 'ALL' ? rows.length : rows.filter((r) => r.status === f).length})
          </Btn>
        ))}
      </div>

      {shown.length === 0 && <Card soft><span style={{ color: 'var(--text-3)' }}>{t('noFeedbackInView')}</span></Card>}

      {shown.map((f) => {
        const st = save[f.id] ?? 'idle';
        const note = noteDraft[f.id] ?? f.adminNote ?? '';
        return (
          <Card key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Chip accent>{CATEGORY_LABEL[f.category]}</Chip>
              <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                {f.user.displayName}{f.user.publicHandle ? ` · @${f.user.publicHandle}` : ''}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-3)' }}>{f.createdAt.slice(0, 10)}</span>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{f.message}</p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <SectionLabel>{t('status')}</SectionLabel>
              <span style={{ fontSize: 12, fontWeight: 700, color: STATUS_COLOR[f.status] }}>{STATUS_LABEL[f.status]}</span>
              {st === 'saving' && <span style={{ fontSize: 11.5, color: 'var(--text-3)' }} role="status">{t('saving')}</span>}
              {st === 'saved' && <span style={{ fontSize: 11.5, color: 'var(--accent-text)' }} role="status">{t('saved')}</span>}
              {st === 'failed' && <span style={{ fontSize: 11.5, color: '#c0392b' }} role="alert">{t('saveFailedRetry')}</span>}
              <select
                aria-label={t('setStatusFor', { name: f.user.displayName })}
                value={f.status}
                onChange={(e) => apply(f.id, { status: e.target.value as FeedbackStatus })}
                style={{ ...fieldStyle, height: 36, padding: '0 10px', marginLeft: 'auto' }}
              >
                {FEEDBACK_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SectionLabel>{t('teamNote')}</SectionLabel>
              <textarea
                value={note}
                onChange={(e) => setNoteDraft((d) => ({ ...d, [f.id]: e.target.value }))}
                rows={2}
                maxLength={2000}
                placeholder={t('teamNotePlaceholder')}
                style={{ ...fieldStyle, padding: 10, fontSize: 14, lineHeight: 1.5, resize: 'vertical', minHeight: 52 }}
              />
            </label>
            <Btn
              kind="soft"
              size="sm"
              icon="check"
              disabled={st === 'saving' || (note.trim() === (f.adminNote ?? '').trim())}
              onClick={() => apply(f.id, { adminNote: note })}
              style={{ alignSelf: 'flex-start' }}
            >
              {t('saveNote')}
            </Btn>
          </Card>
        );
      })}
    </div>
  );
}
