import type { CSSProperties, ReactNode } from 'react';

export function Chip({
  children,
  accent = false,
  style,
}: {
  children: ReactNode;
  accent?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 10px',
        borderRadius: 'var(--r-pill)',
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1,
        background: accent ? 'var(--accent-soft)' : 'var(--surface-2)',
        color: accent ? 'var(--accent-text)' : 'var(--text-2)',
        border: `1px solid ${accent ? 'var(--accent-line)' : 'var(--line)'}`,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
