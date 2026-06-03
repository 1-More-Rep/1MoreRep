'use client';

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type Kind = 'primary' | 'ghost' | 'soft';
type Size = 'sm' | 'md' | 'lg';

export interface BtnProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  children?: ReactNode;
  kind?: Kind;
  size?: Size;
  icon?: IconName;
  full?: boolean;
  style?: CSSProperties;
}

const SIZES: Record<Size, { h: number; px: number; fs: number; gap: number }> = {
  sm: { h: 36, px: 14, fs: 13.5, gap: 7 },
  md: { h: 46, px: 18, fs: 15, gap: 9 },
  lg: { h: 56, px: 22, fs: 16.5, gap: 10 },
};

const KINDS: Record<Kind, CSSProperties> = {
  primary: {
    background: 'var(--accent-strong)',
    color: 'var(--on-accent)',
    border: '1px solid transparent',
    boxShadow: 'var(--shadow-sm)',
  },
  ghost: { background: 'transparent', color: 'var(--text)', border: '1px solid var(--line-2)' },
  soft: { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--line)' },
};

export function Btn({
  children,
  kind = 'primary',
  size = 'md',
  icon,
  full = false,
  style,
  disabled,
  ...rest
}: BtnProps) {
  const s = SIZES[size];
  return (
    <button
      disabled={disabled}
      style={{
        height: s.h,
        padding: `0 ${s.px}px`,
        gap: s.gap,
        width: full ? '100%' : undefined,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--r)',
        fontFamily: 'var(--font-sans)',
        fontSize: s.fs,
        fontWeight: 600,
        letterSpacing: '.005em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: 'transform .12s, filter .15s, background .15s',
        ...KINDS[kind],
        ...style,
      }}
      onMouseDown={(e) => !disabled && (e.currentTarget.style.transform = 'scale(.98)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'lg' ? 20 : 17} stroke={2} />}
      {children}
    </button>
  );
}
