/**
 * Streaming fallback for /app/** segments. Every page here is force-dynamic and awaits
 * DB queries before rendering; this skeleton ships immediately so navigation doesn't
 * show frozen/stale content while the server work runs.
 */
import { getTranslations } from 'next-intl/server';

export default async function Loading() {
  const t = await getTranslations('today');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', padding: 'var(--screen-pad)' }} aria-busy="true" aria-label={t('loading')}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            height: i === 0 ? 120 : 84,
            borderRadius: 'var(--r-lg)',
            background: 'var(--surface-2)',
            opacity: Math.max(0.35, 1 - i * 0.2),
          }}
        />
      ))}
    </div>
  );
}
