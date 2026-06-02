import type { CSSProperties, HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Apply internal padding (default true). */
  pad?: boolean;
  /** Softer, flat variant on surface-2 with no shadow. */
  soft?: boolean;
}

export function Card({ children, style, pad = true, soft = false, ...rest }: CardProps) {
  const base: CSSProperties = {
    background: soft ? 'var(--surface-2)' : 'var(--surface)',
    border: '1px solid var(--line)',
    borderRadius: 'var(--r-lg)',
    boxShadow: soft ? 'none' : 'var(--shadow-sm)',
    padding: pad ? 'var(--pad)' : 0,
    boxSizing: 'border-box',
  };
  return (
    <div style={{ ...base, ...style }} {...rest}>
      {children}
    </div>
  );
}
