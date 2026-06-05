'use client';

import { useActionState, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { submitFeedbackAction, type FeedbackState } from '@/server/actions/feedback';
import { FEEDBACK_CATEGORIES, type FeedbackCategoryT } from '@/lib/validation/feedback';
import { Card } from '@/components/ui/Card';
import { Btn } from '@/components/ui/Btn';
import { SectionLabel } from '@/components/ui/typography';
import { Alert } from '@/components/auth/ui';

const MAX = 2000;

export function FeedbackForm() {
  const t = useTranslations('feedback');
  const [state, action, pending] = useActionState(submitFeedbackAction, {} as FeedbackState);
  const [category, setCategory] = useState<FeedbackCategoryT>('FEATURE');
  const [message, setMessage] = useState('');

  // Clear the message on a successful submit.
  useEffect(() => {
    if (state.notice) {
      setMessage('');
      setCategory('FEATURE');
    }
  }, [state.notice]);

  // Roving arrow-key navigation for the category radiogroup (ARIA APG Radio pattern).
  function onRadioKey(e: React.KeyboardEvent, idx: number) {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
    const next = (idx + dir + FEEDBACK_CATEGORIES.length) % FEEDBACK_CATEGORIES.length;
    setCategory(FEEDBACK_CATEGORIES[next]!);
    document.getElementById(`fb-cat-${next}`)?.focus();
  }

  return (
    <Card>
      <SectionLabel style={{ marginBottom: 12 }}>{t('title')}</SectionLabel>
      <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Alert kind="error">{state.error}</Alert>
        <Alert kind="notice">{state.notice}</Alert>

        <input type="hidden" name="category" value={category} />
        <div role="radiogroup" aria-label={t('whatKindAria')}>
          <span id="feedback-kind-label" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{t('whatKind')}</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {FEEDBACK_CATEGORIES.map((c, i) => (
              <Btn
                key={c}
                id={`fb-cat-${i}`}
                type="button"
                role="radio"
                aria-checked={category === c}
                // APG radiogroup: only the checked radio is tabbable; arrow keys move
                // focus + selection within the group.
                tabIndex={category === c ? 0 : -1}
                onKeyDown={(e) => onRadioKey(e, i)}
                kind={category === c ? 'primary' : 'soft'}
                size="sm"
                onClick={() => setCategory(c)}
              >
                {t(`cat.${c}`)}
              </Btn>
            ))}
          </div>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{t('yourMessage')}</span>
          <textarea
            name="message"
            required
            minLength={5}
            maxLength={MAX}
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('placeholder')}
            style={{ width: '100%', padding: 12, borderRadius: 'var(--r-sm)', border: '1px solid var(--line-2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 15, fontFamily: 'var(--font-sans)', lineHeight: 1.5, resize: 'vertical', minHeight: 96 }}
          />
          <span aria-live="polite" style={{ alignSelf: 'flex-end', fontSize: 11.5, color: message.length > MAX - 100 ? 'var(--accent-text)' : 'var(--text-3)' }}>
            {message.length}/{MAX}
          </span>
        </label>

        <Btn type="submit" icon="check" disabled={pending} style={{ alignSelf: 'flex-start' }}>
          {pending ? t('sending') : t('submit')}
        </Btn>
      </form>
    </Card>
  );
}
