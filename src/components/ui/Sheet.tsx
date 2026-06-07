'use client';

import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
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
  /**
   * When false, Escape and overlay-click do NOT close and the header X is hidden, so
   * the only way out is an explicit in-content action. Use for one-time content that
   * must not be lost to an accidental dismiss (e.g. freshly generated backup codes).
   */
  dismissible?: boolean;
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
  dismissible = true,
}: SheetProps) {
  const t = useTranslations('ui');
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dismissibleRef = useRef(dismissible);
  dismissibleRef.current = dismissible;

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
        if (!dismissibleRef.current) return; // locked sheet — Escape must not discard content
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
      // Only restore focus to the trigger if it's still in the DOM — a sheet closed via
      // router.refresh() unmounts its trigger, and focusing a detached node is a no-op
      // that strands focus on <body>. Skipping lets the refreshed page manage focus.
      if (prevFocus && document.contains(prevFocus)) prevFocus.focus?.();
    };
  }, [open]);

  // Portal to <body> so the overlay escapes any ancestor stacking context (the
  // sticky mobile header/tab bar are z-indexed siblings — without this the bottom
  // tab bar paints OVER the sheet and hides its lower entries).
  if (!open || typeof document === 'undefined') return null;

  const overlay: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,.45)',
    display: 'flex',
    alignItems: side === 'bottom' ? 'flex-end' : 'center',
    justifyContent: 'center',
    zIndex: 60,
    // Reserve the device safe areas (home indicator / notch) so a bottom sheet's
    // last row is never clipped behind the home indicator or browser chrome.
    paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))',
    paddingRight: 16,
    paddingBottom: side === 'bottom' ? 'calc(16px + env(safe-area-inset-bottom, 0px))' : 16,
    paddingLeft: 16,
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
    // Fit within the visible viewport minus the overlay padding + safe areas, so
    // the sheet always scrolls internally instead of overflowing off-screen.
    maxHeight:
      side === 'bottom'
        ? 'calc(100dvh - 32px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))'
        : 'calc(100dvh - 32px)',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    animation: side === 'bottom' ? 'sheetUp .2s cubic-bezier(.2,.7,.3,1)' : 'sheetPop .18s cubic-bezier(.2,.7,.3,1)',
  };

  return createPortal(
    <div
      style={overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && dismissible) onClose();
      }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        // Prefer associating the visible title (aria-labelledby) so the rendered heading
        // IS the accessible name; fall back to aria-label only when there's no title.
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel}
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
            <div id={titleId} style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
            {dismissible && (
              <button
                type="button"
                onClick={onClose}
                aria-label={t('close')}
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
            )}
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
