'use client';

import { useFormStatus } from 'react-dom';
import type { InputHTMLAttributes } from 'react';
import { Btn } from '@/components/ui/Btn';

export function TextField({
  label,
  name,
  ...rest
}: { label: string; name: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{label}</span>
      <input
        name={name}
        style={{
          height: 46,
          padding: '0 14px',
          borderRadius: 'var(--r-sm)',
          border: '1px solid var(--line-2)',
          background: 'var(--surface)',
          color: 'var(--text)',
          fontSize: 15,
          fontFamily: 'var(--font-sans)',
          outline: 'none',
        }}
        {...rest}
      />
    </label>
  );
}

export function Alert({ kind, children }: { kind: 'error' | 'notice'; children: React.ReactNode }) {
  if (!children) return null;
  const error = kind === 'error';
  return (
    <div
      role={error ? 'alert' : 'status'}
      style={{
        fontSize: 13.5,
        lineHeight: 1.4,
        padding: '10px 12px',
        borderRadius: 'var(--r-sm)',
        background: error ? 'color-mix(in oklab, #d23b3b 12%, var(--surface))' : 'var(--accent-soft)',
        color: error ? '#c0392b' : 'var(--accent-text)',
        border: `1px solid ${error ? 'color-mix(in oklab, #d23b3b 30%, var(--surface))' : 'var(--accent-line)'}`,
      }}
    >
      {children}
    </div>
  );
}

export function SubmitBtn({ children, icon }: { children: React.ReactNode; icon?: 'play' | 'check' | 'arrowR' }) {
  const { pending } = useFormStatus();
  return (
    <Btn type="submit" full size="lg" icon={icon} disabled={pending}>
      {pending ? 'Please wait…' : children}
    </Btn>
  );
}
