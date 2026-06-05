'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Select } from '@/components/ui';
import { saveLocaleAction } from '@/server/actions/locale';
import { LOCALES, LOCALE_LABELS, type Locale } from '@/i18n/config';

/** Flag-based language picker. Persists to the cookie + (if signed in) the account. */
export function LanguageSelector({ current, label }: { current: Locale; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Select<Locale>
      label={label}
      ariaLabel="Language"
      value={current}
      disabled={pending}
      onChange={(v) =>
        start(async () => {
          await saveLocaleAction(v);
          router.refresh();
        })
      }
      options={LOCALES.map((l) => ({ value: l, label: LOCALE_LABELS[l].label, glyph: LOCALE_LABELS[l].flag }))}
    />
  );
}
