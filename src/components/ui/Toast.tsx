'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastKind, IconName> = { success: 'check', error: 'x', info: 'bolt' };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const remove = useCallback((id: number) => setItems((xs) => xs.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = nextId.current++;
      setItems((xs) => [...xs, { id, kind, message }]);
      // Auto-dismiss; errors linger a little longer.
      const ttl = kind === 'error' ? 6000 : 3500;
      setTimeout(() => remove(id), ttl);
    },
    [remove],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          zIndex: 80,
          pointerEvents: 'none',
          padding: '0 16px',
        }}
      >
        {items.map((t) => {
          const error = t.kind === 'error';
          const success = t.kind === 'success';
          return (
            <div
              key={t.id}
              role={error ? 'alert' : 'status'}
              onClick={() => remove(t.id)}
              style={{
                pointerEvents: 'auto',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                maxWidth: 460,
                width: 'fit-content',
                padding: '11px 15px',
                borderRadius: 'var(--r-pill)',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text)',
                background: 'var(--surface)',
                border: `1px solid ${error ? 'color-mix(in oklab,#d23b3b 34%,var(--surface))' : success ? 'var(--accent-line)' : 'var(--line-2)'}`,
                boxShadow: 'var(--shadow)',
                animation: 'toastIn .2s cubic-bezier(.2,.7,.3,1)',
              }}
            >
              <span
                aria-hidden
                style={{
                  display: 'inline-flex',
                  color: error ? '#c0392b' : success ? 'var(--accent-text)' : 'var(--text-2)',
                }}
              >
                <Icon name={ICONS[t.kind]} size={17} stroke={2.2} />
              </span>
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  // No-throw fallback so components work in tests / outside the provider.
  if (!ctx) return { toast: () => {} };
  return ctx;
}
