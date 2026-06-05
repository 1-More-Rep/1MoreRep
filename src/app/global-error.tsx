'use client';

import { useEffect } from 'react';

/**
 * Last-resort boundary for errors thrown in the ROOT layout itself (where the normal
 * error.tsx can't render because it lives inside that layout). Must render its own
 * <html>/<body>. Kept dependency-free and self-styled.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: '#666', maxWidth: 420, margin: 0, lineHeight: 1.5 }}>
            The app hit an unexpected error. Reload to continue.
          </p>
          <button
            onClick={reset}
            style={{ height: 44, padding: '0 20px', borderRadius: 8, border: 'none', background: '#111', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
