'use client';

import { useActionState, useEffect, useState } from 'react';
import { submitFeedbackAction, type FeedbackState } from '@/server/actions/feedback';
import { FEEDBACK_CATEGORIES, CATEGORY_LABEL, type FeedbackCategoryT } from '@/lib/validation/feedback';
import { Card } from '@/components/ui/Card';
import { Btn } from '@/components/ui/Btn';
import { SectionLabel } from '@/components/ui/typography';
import { Alert } from '@/components/auth/ui';

const MAX = 2000;

export function FeedbackForm() {
  const [state, action, pending] = useActionState(submitFeedbackAction, {} as FeedbackState);
  const [category, setCategory] = useState<FeedbackCategoryT>('FEATURE');
  const [message, setMessage] = useState('');

  // Clear the message on a successful submit.
  useEffect(() => {
    if (state.notice) setMessage('');
  }, [state.notice]);

  return (
    <Card>
      <SectionLabel style={{ marginBottom: 12 }}>Send feedback</SectionLabel>
      <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Alert kind="error">{state.error}</Alert>
        <Alert kind="notice">{state.notice}</Alert>

        <input type="hidden" name="category" value={category} />
        <div role="radiogroup" aria-label="What kind of feedback?">
          <span id="feedback-kind-label" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>What kind?</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {FEEDBACK_CATEGORIES.map((c) => (
              <Btn
                key={c}
                type="button"
                role="radio"
                aria-checked={category === c}
                kind={category === c ? 'primary' : 'soft'}
                size="sm"
                onClick={() => setCategory(c)}
              >
                {CATEGORY_LABEL[c]}
              </Btn>
            ))}
          </div>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Your message</span>
          <textarea
            name="message"
            required
            minLength={5}
            maxLength={MAX}
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us what you'd love, what's broken, or what could be better… (5+ characters)"
            style={{ width: '100%', padding: 12, borderRadius: 'var(--r-sm)', border: '1px solid var(--line-2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 15, fontFamily: 'var(--font-sans)', lineHeight: 1.5, resize: 'vertical', minHeight: 96 }}
          />
          <span aria-live="polite" style={{ alignSelf: 'flex-end', fontSize: 11.5, color: message.length > MAX - 100 ? 'var(--accent-text)' : 'var(--text-3)' }}>
            {message.length}/{MAX}
          </span>
        </label>

        <Btn type="submit" icon="check" disabled={pending} style={{ alignSelf: 'flex-start' }}>
          {pending ? 'Sending…' : 'Submit feedback'}
        </Btn>
      </form>
    </Card>
  );
}
