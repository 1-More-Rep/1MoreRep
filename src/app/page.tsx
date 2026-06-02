/**
 * P0 landing splash — proves the design-token system renders on-brand.
 * Replaced by the real auth/Today routing in later phases.
 */
export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        padding: 'var(--screen-pad)',
        background: 'var(--bg)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          aria-hidden
          style={{
            width: 56,
            height: 56,
            borderRadius: 'var(--r)',
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow)',
          }}
        >
          <svg width="30" height="30" viewBox="0 0 100 100" fill="none">
            <path
              d="M54 26 38 56h12L46 78l28-36H58l4-16z"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1
          data-testid="brand-wordmark"
          style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}
        >
          1MoreRep
        </h1>
      </div>
      <p style={{ color: 'var(--text-2)', fontSize: 16, maxWidth: 420, textAlign: 'center', margin: 0 }}>
        A calm, data-confident gym tracker. Build in progress.
      </p>
      <span
        className="mono"
        style={{
          fontSize: 13,
          color: 'var(--text-3)',
          border: '1px solid var(--line)',
          background: 'var(--surface)',
          borderRadius: 'var(--r-pill)',
          padding: '6px 12px',
        }}
      >
        v0.1.0 · phase 0
      </span>
    </main>
  );
}
