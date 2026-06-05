'use client';

import { useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Icon } from './Icon';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Accessible dialog title; rendered as a header unless `hideHeader`. */
  title?: ReactNode;
  /** bottom = mobile-style bottom sheet (default); center = centered modal. */
  side?: 'bottom' | 'center';
  /** Hide the default header row (title + close button). */
  hideHeader?: boolean;
  children: ReactNode;
  maxWidth?: number;
  /** aria-label when no visible title is given. */
  ariaLabel?: string;
}

/**
 * Accessible modal/sheet shell: overlay + focus trap + Escape + focus restore +
 * overlay-click-to-close + safe-area inset. Matches FinishModal's bespoke a11y
 * plumbing so dialogs across the app behave identically (WCAG 2.1.2 / 2.4.3).
 */
export function Sheet({
  open,
  onClose,
  title,
  side = 'bottom',
  hideHeader = false,
  children,
  maxWidth = 440,
  ariaLabel,
}: SheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = () => {
      const root = sheetRef.current;
      if (!root) return [] as HTMLElement[];
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
    };
    focusables()[0]?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab') {
        const els = focusables();
        if (els.length === 0) return;
        const first = els[0]!;
        const last = els[els.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const overlay: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,.45)',
    display: 'flex',
    alignItems: side === 'bottom' ? 'flex-end' : 'center',
    justifyContent: 'center',
    zIndex: 60,
    padding: 16,
    animation: 'sheetFade .16s ease',
  };
  const sheet: CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--line)',
    borderRadius: 'var(--r-lg)',
    boxShadow: 'var(--shadow)',
    padding: 'calc(var(--pad) * 1.1)',
    width: '100%',
    maxWidth,
    maxHeight: 'calc(100dvh - 32px)',
    overflowY: 'auto',
    marginBottom: side === 'bottom' ? 'env(safe-area-inset-bottom, 0)' : 0,
    animation: side === 'bottom' ? 'sheetUp .2s cubic-bezier(.2,.7,.3,1)' : 'sheetPop .18s cubic-bezier(.2,.7,.3,1)',
  };

  return (
    <div
      style={overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : ariaLabel}
        style={sheet}
      >
        {!hideHeader && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: title ? 14 : 0,
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 34,
                height: 34,
                borderRadius: 'var(--r-pill)',
                border: '1px solid var(--line)',
                background: 'var(--surface-2)',
                color: 'var(--text-2)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <Icon name="x" size={18} stroke={2} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
