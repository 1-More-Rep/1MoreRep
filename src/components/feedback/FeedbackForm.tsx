'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { submitFeedbackAction, type FeedbackState } from '@/server/actions/feedback';
import { FEEDBACK_CATEGORIES, CATEGORY_LABEL, type FeedbackCategoryT } from '@/lib/validation/feedback';
import { Card } from '@/components/ui/Card';
import { Btn } from '@/components/ui/Btn';
import { SectionLabel } from '@/components/ui/typography';
import { Alert } from '@/components/auth/ui';

export function FeedbackForm() {
  const [state, action, pending] = useActionState(submitFeedbackAction, {} as FeedbackState);
  const [category, setCategory] = useState<FeedbackCategoryT>('FEATURE');
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the message on a successful submit.
  useEffect(() => {
    if (state.notice) formRef.current?.reset();
  }, [state.notice]);

  return (
    <Card>
      <SectionLabel style={{ marginBottom: 12 }}>Send feedback</SectionLabel>
      <form ref={formRef} action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Alert kind="error">{state.error}</Alert>
        <Alert kind="notice">{state.notice}</Alert>

        <input type="hidden" name="category" value={category} />
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>What kind?</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {FEEDBACK_CATEGORIES.map((c) => (
              <Btn key={c} type="button" kind={category === c ? 'primary' : 'soft'} size="sm" onClick={() => setCategory(c)}>
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
            maxLength={2000}
            rows={4}
            placeholder="Tell us what you'd love, what's broken, or what could be better…"
            style={{ width: '100%', padding: 12, borderRadius: 'var(--r-sm)', border: '1px solid var(--line-2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 15, fontFamily: 'var(--font-sans)', lineHeight: 1.5, resize: 'vertical', minHeight: 96 }}
          />
        </label>

        <Btn type="submit" icon="check" disabled={pending} style={{ alignSelf: 'flex-start' }}>
          {pending ? 'Sending…' : 'Submit feedback'}
        </Btn>
      </form>
    </Card>
  );
}
