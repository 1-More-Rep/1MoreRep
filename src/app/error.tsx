'use client';

import { useEffect } from 'react';

/**
 * Segment error boundary for everything under app/ (and any nested segment without its
 * own error.tsx). Without this, an unhandled error in a Server Component rendered the
 * default Next error overlay; now users get a recoverable UI.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Server errors are already logged by Next; this captures client-side render failures.
    console.error(error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 24,
        textAlign: 'center',
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
    >
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Something went wrong</h1>
      <p style={{ fontSize: 14, color: 'var(--text-2)', maxWidth: 420, margin: 0, lineHeight: 1.5 }}>
        An unexpected error occurred. Try again — if it keeps happening, reload the page.
      </p>
      <button
        onClick={reset}
        style={{
          height: 44,
          padding: '0 20px',
          borderRadius: 'var(--r-sm)',
          border: 'none',
          background: 'var(--accent)',
          color: 'var(--on-accent)',
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  );
}
