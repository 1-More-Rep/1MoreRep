import type { ReactNode } from 'react';
import { clamp01 } from '@/domain/units';

/** SVG progress ring. `pct` in 0..1. Children render centered. */
export function Ring({
  pct = 0.6,
  size = 120,
  stroke = 11,
  children,
  label,
}: {
  pct?: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  label?: string;
}) {
  const p = clamp01(pct);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      style={{ position: 'relative', width: size, height: size }}
      role="img"
      aria-label={label ?? `${Math.round(p * 100)}%`}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        {children}
      </div>
    </div>
  );
}
