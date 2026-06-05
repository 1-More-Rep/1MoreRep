'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { Icon } from './Icon';

const fieldBase: CSSProperties = {
  width: '100%',
  padding: '0 14px',
  borderRadius: 'var(--r-sm)',
  border: '1px solid var(--line-2)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 15,
  fontFamily: 'var(--font-sans)',
  boxSizing: 'border-box',
};

function Label({ label, hint }: { label?: ReactNode; hint?: ReactNode }) {
  if (!label) return null;
  return (
    <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{label}</span>
      {hint && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{hint}</span>}
    </span>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  hint?: ReactNode;
}

export function Input({ label, hint, id, style, ...rest }: InputProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <label htmlFor={fieldId} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Label label={label} hint={hint} />
      <input id={fieldId} style={{ ...fieldBase, height: 46, ...style }} {...rest} />
    </label>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
}

export function Textarea({ label, hint, id, style, rows = 4, ...rest }: TextareaProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <label htmlFor={fieldId} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Label label={label} hint={hint} />
      <textarea
        id={fieldId}
        rows={rows}
        style={{ ...fieldBase, padding: '10px 14px', lineHeight: 1.5, resize: 'vertical', ...style }}
        {...rest}
      />
    </label>
  );
}

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** Optional leading glyph: an emoji/flag string or an Icon name handled by the caller. */
  glyph?: ReactNode;
  disabled?: boolean;
}

export interface SelectProps<T extends string> {
  options: SelectOption<T>[];
  value: T | '';
  onChange: (value: T) => void;
  label?: ReactNode;
  hint?: ReactNode;
  placeholder?: string;
  ariaLabel?: string;
  /** Hidden form field name so the value submits with a native <form>. */
  name?: string;
  disabled?: boolean;
  full?: boolean;
}

/**
 * Custom listbox (ARIA combobox/listbox). Unlike a native <select> it can render
 * a leading glyph per option (e.g. a flag for the language picker). Keyboard:
 * Enter/Space/ArrowDown opens; Arrow/Home/End move; Enter selects; Escape closes.
 * Emits a hidden <input> so it still submits inside a plain server-action form.
 */
export function Select<T extends string>({
  options,
  value,
  onChange,
  label,
  hint,
  placeholder = 'Select…',
  ariaLabel,
  name,
  disabled = false,
  full = true,
}: SelectProps<T>) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const idx = options.findIndex((o) => o.value === value);
    setActive(idx >= 0 ? idx : 0);
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, options, value]);

  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function commit(i: number) {
    const o = options[i];
    if (!o || o.disabled) return;
    onChange(o.value);
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      commit(active);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: full ? '100%' : undefined }}>
      <Label label={label} hint={hint} />
      <div ref={rootRef} style={{ position: 'relative' }}>
        {name && <input type="hidden" name={name} value={value} />}
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={`${uid}-list`}
          aria-label={ariaLabel}
          disabled={disabled}
          onClick={() => !disabled && setOpen((o) => !o)}
          onKeyDown={onKey}
          style={{
            ...fieldBase,
            height: 46,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.55 : 1,
            textAlign: 'left',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {selected?.glyph && <span aria-hidden style={{ fontSize: 17, lineHeight: 1 }}>{selected.glyph}</span>}
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: selected ? 'var(--text)' : 'var(--text-3)',
              }}
            >
              {selected ? selected.label : placeholder}
            </span>
          </span>
          <Icon name="chevronD" size={16} stroke={2} style={{ color: 'var(--text-3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
        </button>
        {open && (
          <ul
            ref={listRef}
            role="listbox"
            id={`${uid}-list`}
            aria-label={ariaLabel}
            style={{
              listStyle: 'none',
              margin: '6px 0 0',
              padding: 5,
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 70,
              maxHeight: 280,
              overflowY: 'auto',
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-sm)',
              boxShadow: 'var(--shadow)',
            }}
          >
            {options.map((o, i) => {
              const isSel = o.value === value;
              const isActive = i === active;
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={isSel}
                  data-active={isActive}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => commit(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '9px 10px',
                    borderRadius: 'var(--r-xs)',
                    cursor: o.disabled ? 'not-allowed' : 'pointer',
                    fontSize: 14.5,
                    color: o.disabled ? 'var(--text-3)' : 'var(--text)',
                    background: isActive && !o.disabled ? 'var(--accent-soft)' : 'transparent',
                    opacity: o.disabled ? 0.6 : 1,
                  }}
                >
                  {o.glyph && <span aria-hidden style={{ fontSize: 17, lineHeight: 1 }}>{o.glyph}</span>}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                  {isSel && <Icon name="check" size={16} stroke={2.2} style={{ color: 'var(--accent-text)' }} />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
