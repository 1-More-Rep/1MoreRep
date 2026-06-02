'use client';

import { useActionState } from 'react';
import type { InstanceSettings } from '@prisma/client';
import {
  updateGeneralSettingsAction,
  updateSmtpAction,
  updateLlmAction,
  testSmtpAction,
  type AdminState,
} from '@/server/actions/admin';
import { Card } from '@/components/ui/Card';
import { Btn } from '@/components/ui/Btn';
import { SectionLabel } from '@/components/ui/typography';
import { Alert, TextField } from '@/components/auth/ui';
import { useState } from 'react';

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
  const [provider, setProvider] = useState(s.llmProvider);
  return (
    <Card>
      <SectionLabel style={{ marginBottom: 14 }}>Workout generator LLM</SectionLabel>
      <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Alert kind="error">{state.error}</Alert>
        <Alert kind="notice">{state.notice}</Alert>
        <div style={fieldRow}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Provider</span>
            <select name="llmProvider" value={provider} onChange={(e) => setProvider(e.target.value)} style={selectStyle}>
              <option value="NONE">None (deterministic only)</option>
              <option value="OLLAMA">Ollama (local)</option>
              <option value="ANTHROPIC">Anthropic</option>
              <option value="OPENAI">OpenAI</option>
            </select>
          </label>
          <TextField label="Base URL" name="llmBaseUrl" defaultValue={s.llmBaseUrl ?? ''} placeholder="http://ollama:11434" />
          <TextField label="Model" name="llmModel" defaultValue={s.llmModel ?? ''} placeholder="llama3.1" />
          {provider !== 'NONE' && provider !== 'OLLAMA' && (
            <TextField label="API key" name="llmApiKey" type="password" placeholder={s.llmApiKeyEnc ? '•••••• (unchanged)' : ''} />
          )}
        </div>
        <Btn type="submit" icon="check" style={{ alignSelf: 'flex-start' }}>Save LLM</Btn>
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
