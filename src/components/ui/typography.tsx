import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

/** Uppercase, letter-spaced section label (muted). */
export function SectionLabel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        fontSize: 11.5,
        fontWeight: 600,
        letterSpacing: '.13em',
        textTransform: 'uppercase',
        color: 'var(--text-3)',
        fontFamily: 'var(--font-sans)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Monospace, tabular-figures wrapper — used for every number in the app. */
export function Mono({ children, style, ...rest }: { children: ReactNode } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontFeatureSettings: '"tnum" 1', ...style }} {...rest}>
      {children}
    </span>
  );
}

/** 1px hairline divider. */
export function Divider({ style }: { style?: CSSProperties }) {
  return <div style={{ height: 1, background: 'var(--line)', ...style }} />;
}
