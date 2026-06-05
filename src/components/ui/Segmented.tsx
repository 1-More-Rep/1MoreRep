'use client';

import type { CSSProperties } from 'react';
import { useId } from 'react';
import { Icon, type IconName } from './Icon';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible group label. */
  ariaLabel: string;
  size?: 'sm' | 'md';
  style?: CSSProperties;
}

/**
 * Pill-track segmented control with full WAI-ARIA tablist semantics and roving
 * tabindex (Arrow/Home/End), matching ProgressTabs. The active segment lifts
 * onto --surface with a subtle shadow.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  style,
}: SegmentedProps<T>) {
  const uid = useId();
  const fs = size === 'sm' ? 12.5 : 13.5;
  const pad = size === 'sm' ? '7px 6px' : '9px 8px';

  function onKey(e: React.KeyboardEvent, idx: number) {
    let next = idx;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % options.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + options.length) % options.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = options.length - 1;
    else return;
    e.preventDefault();
    const opt = options[next]!;
    onChange(opt.value);
    document.getElementById(`${uid}-${opt.value}`)?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        gap: 4,
        padding: 4,
        background: 'var(--surface-2)',
        borderRadius: 'var(--r-pill)',
        ...style,
      }}
    >
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            id={`${uid}-${o.value}`}
            type="button"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              border: 'none',
              cursor: 'pointer',
              padding: pad,
              fontSize: fs,
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              borderRadius: 'var(--r-pill)',
              background: selected ? 'var(--surface)' : 'transparent',
              color: selected ? 'var(--text)' : 'var(--text-3)',
              boxShadow: selected ? 'var(--shadow-sm)' : 'none',
              transition: 'background .15s, color .15s',
            }}
          >
            {o.icon && <Icon name={o.icon} size={size === 'sm' ? 15 : 16} stroke={2} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
