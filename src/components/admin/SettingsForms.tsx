'use client';

import { useActionState, useState, useTransition } from 'react';
import type { InstanceSettings } from '@prisma/client';
import {
  updateGeneralSettingsAction,
  updateSmtpAction,
  updateLlmAction,
  updateBrandingAction,
  testSmtpAction,
  testLlmAction,
  probeLlmAction,
  type AdminState,
} from '@/server/actions/admin';
import { Card } from '@/components/ui/Card';
import { Btn } from '@/components/ui/Btn';
import { Select } from '@/components/ui/Field';
import { SectionLabel } from '@/components/ui/typography';
import { Alert, TextField } from '@/components/auth/ui';

const empty: AdminState = {};
const fieldRow: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 };

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--text)' }}>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}

export function GeneralForm({ s }: { s: InstanceSettings }) {
  const [state, action] = useActionState(updateGeneralSettingsAction, empty);
  return (
    <Card>
      <SectionLabel style={{ marginBottom: 14 }}>General &amp; registration</SectionLabel>
      <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Alert kind="error">{state.error}</Alert>
        <Alert kind="notice">{state.notice}</Alert>
        <div style={fieldRow}>
          <TextField label="Instance name" name="brandName" defaultValue={s.brandName} />
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Default units</span>
            <select name="defaultUnitSystem" defaultValue={s.defaultUnitSystem} style={selectStyle}>
              <option value="METRIC">Metric (kg)</option>
              <option value="IMPERIAL">Imperial (lb)</option>
            </select>
          </label>
        </div>
        <Toggle name="allowSelfRegistration" label="Allow people to register themselves" defaultChecked={s.allowSelfRegistration} />
        <Toggle name="requireEmailVerification" label="Require email verification for new accounts" defaultChecked={s.requireEmailVerification} />
        <Btn type="submit" icon="check" style={{ alignSelf: 'flex-start' }}>Save settings</Btn>
      </form>
    </Card>
  );
}

export function SmtpForm({ s }: { s: InstanceSettings }) {
  const [state, action] = useActionState(updateSmtpAction, empty);
  const [test, testAction] = useActionState(async () => testSmtpAction(), empty);
  return (
    <Card>
      <SectionLabel style={{ marginBottom: 14 }}>Email (SMTP)</SectionLabel>
      <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Alert kind="error">{state.error}</Alert>
        <Alert kind="notice">{state.notice}</Alert>
        <div style={fieldRow}>
          <TextField label="Host" name="smtpHost" defaultValue={s.smtpHost ?? ''} placeholder="smtp.example.com" />
          <TextField label="Port" name="smtpPort" type="number" defaultValue={s.smtpPort ?? 587} />
          <TextField label="Username" name="smtpUser" defaultValue={s.smtpUser ?? ''} />
          <TextField label="Password" name="smtpPassword" type="password" placeholder={s.smtpPasswordEnc ? '•••••• (unchanged)' : ''} />
          <TextField label="From address" name="smtpFrom" defaultValue={s.smtpFrom ?? ''} placeholder="no-reply@example.com" />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
          <input type="checkbox" name="smtpSecure" defaultChecked={s.smtpSecure} /> Use TLS (port 465)
        </label>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn type="submit" icon="check">Save SMTP</Btn>
        </div>
      </form>
      <form action={testAction} style={{ marginTop: 10 }}>
        <Alert kind="error">{test.error}</Alert>
        <Alert kind="notice">{test.notice}</Alert>
        <Btn type="submit" kind="ghost" size="sm">Send test / verify connection</Btn>
      </form>
    </Card>
  );
}

export function LlmForm({ s }: { s: InstanceSettings }) {
  const [state, action] = useActionState(updateLlmAction, empty);
  const [test, testAction] = useActionState(async () => testLlmAction(), empty);
  const [provider, setProvider] = useState(s.llmProvider);
  const [baseUrl, setBaseUrl] = useState(s.llmBaseUrl ?? '');
  const [model, setModel] = useState(s.llmModel ?? '');
  // Models discovered by "Check connection". null = not probed yet (free-text fallback).
  const [models, setModels] = useState<string[] | null>(null);
  const [probe, setProbe] = useState<AdminState>(empty);
  const [probing, startProbe] = useTransition();
  const unsupported = provider === 'ANTHROPIC' || provider === 'OPENAI';
  const isOllama = provider === 'OLLAMA';

  function resetProbe() {
    setModels(null);
    setProbe(empty);
  }

  function checkConnection() {
    const fd = new FormData();
    fd.set('llmProvider', provider);
    fd.set('llmBaseUrl', baseUrl);
    startProbe(async () => {
      const res = await probeLlmAction(fd);
      setProbe(res);
      if (res.models) {
        setModels(res.models);
        // Auto-select the saved model if it's still installed, else the first one.
        if (res.models.length > 0 && !res.models.includes(model)) setModel(res.models[0]!);
      }
    });
  }

  // When the discovered list is available, build dropdown options (keeping a
  // previously-saved-but-missing model visible so it isn't silently dropped).
  const modelOptions =
    models && models.length > 0
      ? [
          ...(model && !models.includes(model) ? [{ value: model, label: `${model} (not installed)` }] : []),
          ...models.map((m) => ({ value: m, label: m })),
        ]
      : [];

  return (
    <Card>
      <SectionLabel style={{ marginBottom: 14 }}>Workout generator LLM</SectionLabel>
      <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Alert kind="error">{state.error}</Alert>
        <Alert kind="notice">{state.notice}</Alert>
        <div style={fieldRow}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Provider</span>
            <select
              name="llmProvider"
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                resetProbe();
              }}
              style={selectStyle}
            >
              <option value="NONE">None (deterministic only)</option>
              <option value="OLLAMA">Ollama (local)</option>
              <option value="ANTHROPIC" disabled>Anthropic (coming soon)</option>
              <option value="OPENAI" disabled>OpenAI (coming soon)</option>
            </select>
          </label>
          <TextField
            label="Base URL"
            name="llmBaseUrl"
            value={baseUrl}
            onChange={(e) => {
              setBaseUrl(e.target.value);
              resetProbe();
            }}
            placeholder="http://ollama:11434"
          />
          {models && models.length > 0 ? (
            <Select
              label="Model"
              name="llmModel"
              ariaLabel="Model"
              value={model}
              onChange={setModel}
              options={modelOptions}
              placeholder="Select a model…"
            />
          ) : (
            <TextField
              label="Model"
              name="llmModel"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="llama3.1"
            />
          )}
          {provider !== 'NONE' && provider !== 'OLLAMA' && (
            <TextField label="API key" name="llmApiKey" type="password" placeholder={s.llmApiKeyEnc ? '•••••• (unchanged)' : ''} />
          )}
        </div>

        {isOllama && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Btn type="button" kind="soft" size="sm" icon="repeat" onClick={checkConnection} disabled={probing || !baseUrl}>
              {probing ? 'Checking…' : 'Check connection'}
            </Btn>
            <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
              Detects installed models so you can pick one instead of typing it.
            </span>
          </div>
        )}
        {probe.error && <Alert kind="error">{probe.error}</Alert>}
        {probe.notice && <Alert kind="notice">{probe.notice}</Alert>}

        {unsupported && (
          <Alert kind="error">
            This provider isn&apos;t implemented yet — saving will be rejected. Use Ollama or None for now.
          </Alert>
        )}
        <Btn type="submit" icon="check" style={{ alignSelf: 'flex-start' }} disabled={unsupported}>Save LLM</Btn>
      </form>
      <form action={testAction} style={{ marginTop: 10 }}>
        <Alert kind="error">{test.error}</Alert>
        <Alert kind="notice">{test.notice}</Alert>
        <Btn type="submit" kind="ghost" size="sm">Test prompt (saved settings)</Btn>
      </form>
    </Card>
  );
}

export function BrandingForm({ s }: { s: InstanceSettings }) {
  const [state, action] = useActionState(updateBrandingAction, empty);
  return (
    <Card>
      <SectionLabel style={{ marginBottom: 14 }}>Branding</SectionLabel>
      <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Alert kind="error">{state.error}</Alert>
        <Alert kind="notice">{state.notice}</Alert>
        <div style={fieldRow}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Theme color</span>
            <input
              type="color"
              name="themeColor"
              defaultValue={s.themeColor}
              style={{ height: 46, width: 80, padding: 4, borderRadius: 'var(--r-sm)', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
              Logo {s.brandLogoKey ? '(replace)' : ''}
            </span>
            <input
              type="file"
              name="brandLogo"
              accept="image/png,image/jpeg,image/webp"
              style={{ fontSize: 14, color: 'var(--text-2)' }}
            />
          </label>
        </div>
        <Btn type="submit" icon="check" style={{ alignSelf: 'flex-start' }}>Save branding</Btn>
      </form>
    </Card>
  );
}

const selectStyle: React.CSSProperties = {
  height: 46,
  padding: '0 12px',
  borderRadius: 'var(--r-sm)',
  border: '1px solid var(--line-2)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 14,
  fontFamily: 'var(--font-sans)',
};
