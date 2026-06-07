'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { Btn, Card, SectionLabel, Sheet, Input, Icon } from '@/components/ui';
import { Alert } from '@/components/auth/ui';
import {
  startPasskeyRegistrationAction,
  finishPasskeyRegistrationAction,
  removePasskeyAction,
  startTotpEnrollmentAction,
  confirmTotpEnrollmentAction,
  disableTotpAction,
  regenerateBackupCodesAction,
  type TotpEnrollStart,
} from '@/server/actions/twofactor';

export interface PasskeyView {
  id: string;
  name: string | null;
  deviceType: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

/** Best-effort device label so a freshly-added passkey has a recognizable name. */
function guessPasskeyName(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iPhone / iPad';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Android/.test(ua)) return 'Android';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Passkey';
}

export function SecurityControls({
  passkeys,
  totpEnabled,
  backupRemaining,
}: {
  passkeys: PasskeyView[];
  totpEnabled: boolean;
  backupRemaining: number;
}) {
  const t = useTranslations('security');
  const router = useRouter();

  return (
    <>
      <PasskeysCard passkeys={passkeys} t={t} router={router} />
      <AuthenticatorCard totpEnabled={totpEnabled} backupRemaining={backupRemaining} t={t} router={router} />
    </>
  );
}

type T = ReturnType<typeof useTranslations>;
type Router = ReturnType<typeof useRouter>;

/**
 * Inline password re-authentication. Enabling an authenticator app / adding a passkey
 * binds a new second factor, so we confirm the account password first — a hijacked
 * session must not be able to plant a credential that would survive the real owner's
 * password reset.
 */
function ReauthGate({
  t,
  pending,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  t: T;
  pending: boolean;
  submitLabel: string;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}) {
  const [pw, setPw] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(pw);
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>{t('reauthHint')}</p>
      <Input label={t('password')} type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" autoFocus />
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn type="submit" size="sm" disabled={pending || pw.length < 1}>{submitLabel}</Btn>
        <Btn kind="ghost" size="sm" type="button" disabled={pending} onClick={onCancel}>{t('cancel')}</Btn>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Passkeys
// ---------------------------------------------------------------------------

function PasskeysCard({ passkeys, t, router }: { passkeys: PasskeyView[]; t: T; router: Router }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string>();
  const [supported, setSupported] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setSupported(browserSupportsWebAuthn());
  }, []);

  function add(password: string) {
    setErr(undefined);
    start(async () => {
      const res = await startPasskeyRegistrationAction(password);
      if ('error' in res) return setErr(res.error);
      let att;
      try {
        att = await startRegistration({ optionsJSON: res.options });
      } catch {
        return setErr(t('passkeyCancelled'));
      }
      const fin = await finishPasskeyRegistrationAction(att, guessPasskeyName());
      if (fin.error) return setErr(fin.error);
      setAdding(false);
      router.refresh();
    });
  }

  function remove(id: string) {
    setErr(undefined);
    start(async () => {
      const res = await removePasskeyAction(id);
      if (res.error) return setErr(res.error);
      router.refresh();
    });
  }

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ width: 38, height: 38, borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', color: 'var(--accent-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="key" size={20} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <SectionLabel>{t('passkeys')}</SectionLabel>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '4px 0 0', lineHeight: 1.45 }}>{t('passkeysDesc')}</p>
        </div>
      </div>

      {err && <Alert kind="error">{err}</Alert>}

      {passkeys.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {passkeys.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
              <Icon name="key" size={18} style={{ color: 'var(--text-2)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name || t('passkeyFallbackName')}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                  {t('added', { date: new Date(p.createdAt).toLocaleDateString() })}
                  {p.lastUsedAt ? ` · ${t('lastUsed', { date: new Date(p.lastUsedAt).toLocaleDateString() })}` : ''}
                </div>
              </div>
              <Btn kind="ghost" size="sm" icon="trash" disabled={pending} onClick={() => remove(p.id)} aria-label={t('removePasskey')} />
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>{t('noPasskeys')}</p>
      )}

      {adding ? (
        <ReauthGate
          t={t}
          pending={pending}
          submitLabel={t('addPasskey')}
          onSubmit={add}
          onCancel={() => {
            setAdding(false);
            setErr(undefined);
          }}
        />
      ) : (
        <Btn
          kind="soft"
          size="sm"
          icon="plus"
          disabled={pending || !supported}
          onClick={() => {
            setAdding(true);
            setErr(undefined);
          }}
          style={{ alignSelf: 'flex-start' }}
        >
          {t('addPasskey')}
        </Btn>
      )}
      {!supported && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{t('passkeyUnsupported')}</span>}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Authenticator app (TOTP)
// ---------------------------------------------------------------------------

function AuthenticatorCard({ totpEnabled, backupRemaining, t, router }: { totpEnabled: boolean; backupRemaining: number; t: T; router: Router }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string>();
  const [enroll, setEnroll] = useState<TotpEnrollStart | null>(null);
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'idle' | 'disable' | 'regenerate'>('idle');
  const [shownCodes, setShownCodes] = useState<string[] | null>(null);
  const [setupGate, setSetupGate] = useState(false);

  function begin(password: string) {
    setErr(undefined);
    start(async () => {
      const res = await startTotpEnrollmentAction(password);
      if ('error' in res) return setErr(res.error);
      setSetupGate(false);
      setEnroll(res);
      setCode('');
    });
  }

  function confirm() {
    setErr(undefined);
    start(async () => {
      const res = await confirmTotpEnrollmentAction(code);
      if (res.error) return setErr(res.error);
      setEnroll(null);
      setCode('');
      setShownCodes(res.backupCodes ?? []);
      router.refresh();
    });
  }

  function submitCode() {
    setErr(undefined);
    start(async () => {
      if (mode === 'disable') {
        const res = await disableTotpAction(code);
        if (res.error) return setErr(res.error);
        setMode('idle');
        setCode('');
        router.refresh();
      } else if (mode === 'regenerate') {
        const res = await regenerateBackupCodesAction(code);
        if (res.error) return setErr(res.error);
        setMode('idle');
        setCode('');
        setShownCodes(res.backupCodes ?? []);
        router.refresh();
      }
    });
  }

  const codeField = (onSubmit: () => void, submitLabel: string) => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      {/* inputMode="text" (not numeric): the field also accepts an alphanumeric
          backup code, which is untypeable on a numeric-only mobile keypad. */}
      <Input
        label={t('enterCode')}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        inputMode="text"
        autoComplete="one-time-code"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        placeholder="123456"
        maxLength={9}
        autoFocus
        style={{ letterSpacing: '.3em', fontFamily: 'var(--font-mono)' }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn type="submit" size="sm" disabled={pending || code.trim().length < 6}>{submitLabel}</Btn>
        <Btn
          kind="ghost"
          size="sm"
          type="button"
          disabled={pending}
          onClick={() => {
            setMode('idle');
            setEnroll(null);
            setCode('');
            setErr(undefined);
          }}
        >
          {t('cancel')}
        </Btn>
      </div>
    </form>
  );

  return (
    <>
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{ width: 38, height: 38, borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', color: 'var(--accent-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="qr" size={20} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <SectionLabel>{t('authenticator')}</SectionLabel>
              {totpEnabled && (
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-text)', background: 'var(--accent-soft)', borderRadius: 'var(--r-pill)', padding: '2px 8px' }}>{t('enabled')}</span>
              )}
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '4px 0 0', lineHeight: 1.45 }}>{t('authenticatorDesc')}</p>
          </div>
        </div>

        {err && <Alert kind="error">{err}</Alert>}

        {/* Enrollment wizard */}
        {enroll ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13.5, color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>{t('scanQr')}</p>
            {/* The QR is decorative for AT — the secret key below is the accessible
                alternative, so hide the SVG from screen readers. */}
            <div aria-hidden style={{ alignSelf: 'center', background: '#fff', padding: 12, borderRadius: 'var(--r-sm)', width: 200, height: 200, boxSizing: 'content-box' }} dangerouslySetInnerHTML={{ __html: enroll.qrSvg }} />
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', textAlign: 'center' }}>
              {t('orEnterKey')}
              <div style={{ marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-2)', wordBreak: 'break-all', userSelect: 'all' }}>{enroll.secret}</div>
            </div>
            {codeField(confirm, t('verifyEnable'))}
          </div>
        ) : mode !== 'idle' ? (
          codeField(submitCode, mode === 'disable' ? t('disable') : t('regenerate'))
        ) : totpEnabled ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{t('backupRemaining', { count: backupRemaining })}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn kind="ghost" size="sm" icon="repeat" disabled={pending} onClick={() => { setMode('regenerate'); setErr(undefined); setCode(''); }}>{t('regenerateBackup')}</Btn>
              <Btn kind="ghost" size="sm" icon="trash" disabled={pending} onClick={() => { setMode('disable'); setErr(undefined); setCode(''); }}>{t('disable')}</Btn>
            </div>
          </div>
        ) : setupGate ? (
          <ReauthGate
            t={t}
            pending={pending}
            submitLabel={t('continue')}
            onSubmit={begin}
            onCancel={() => {
              setSetupGate(false);
              setErr(undefined);
            }}
          />
        ) : (
          <Btn kind="soft" size="sm" icon="qr" disabled={pending} onClick={() => { setSetupGate(true); setErr(undefined); }} style={{ alignSelf: 'flex-start' }}>{t('setUp')}</Btn>
        )}
      </Card>

      {shownCodes && <BackupCodesSheet codes={shownCodes} t={t} onClose={() => setShownCodes(null)} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// One-time backup-code display
// ---------------------------------------------------------------------------

function BackupCodesSheet({ codes, t, onClose }: { codes: string[]; t: T; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [copyErr, setCopyErr] = useState(false);
  const text = codes.join('\n');

  function copy() {
    setCopyErr(false);
    // The Clipboard API is unavailable on insecure (plain-HTTP) origins — which this
    // app explicitly supports for LAN/IP self-hosting — and can be denied by policy.
    // Surface a fallback instruction instead of silently doing nothing.
    const cb = navigator.clipboard;
    if (!cb) return setCopyErr(true);
    cb.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => setCopyErr(true),
    );
  }

  function download() {
    const blob = new Blob([`${text}\n`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  // dismissible=false: these one-time codes are shown ONCE — Escape / overlay-click / X
  // must not silently discard them. The only way out is the explicit "I've saved them"
  // button below.
  return (
    <Sheet open onClose={onClose} title={t('backupCodesTitle')} side="center" dismissible={false}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontSize: 13.5, color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>{t('backupCodesIntro')}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 14, borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', border: '1px solid var(--line)', fontFamily: 'var(--font-mono)', fontSize: 14.5, letterSpacing: '.04em' }}>
          {codes.map((c) => (
            <span key={c} style={{ userSelect: 'all', textAlign: 'center', color: 'var(--text)' }}>{c}</span>
          ))}
        </div>
        {copyErr && <Alert kind="error">{t('copyFailed')}</Alert>}
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn kind="soft" size="sm" icon={copied ? 'check' : 'copy'} onClick={copy}>{copied ? t('copied') : t('copy')}</Btn>
          <Btn kind="soft" size="sm" icon="arrowUp" onClick={download}>{t('download')}</Btn>
        </div>
        <Btn size="md" onClick={onClose}>{t('savedClose')}</Btn>
      </div>
    </Sheet>
  );
}
