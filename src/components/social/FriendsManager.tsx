'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  respondFriendAction,
  removeFriendAction,
  searchUsersAction,
  sendRequestByHandleAction,
  blockUserActionResult,
  generateInviteLinkAction,
} from '@/server/actions/social';
import { Card } from '@/components/ui/Card';
import { Btn } from '@/components/ui/Btn';
import { Chip } from '@/components/ui/Chip';
import { Icon, Mono, SectionLabel } from '@/components/ui';
import { Alert, TextField } from '@/components/auth/ui';

export interface FriendLite {
  id: string;
  displayName: string;
  publicHandle: string | null;
  streak?: number;
}

interface SearchHit {
  id: string;
  displayName: string;
  publicHandle: string | null;
}

export function FriendsManager({ friends, requests }: { friends: FriendLite[]; requests: FriendLite[] }) {
  const [, start] = useTransition();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; notice?: string }>({});
  const [copied, setCopied] = useState(false);
  const seq = useRef(0);

  // Debounced live lookup (≥2 chars). The latest query wins (seq guard).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const hits = await searchUsersAction(q);
        if (mine === seq.current) setResults(hits.map((h) => ({ id: h.id, displayName: h.displayName, publicHandle: h.publicHandle })));
      } finally {
        if (mine === seq.current) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  function add(handle: string | null) {
    if (!handle) return;
    start(async () => {
      const r = await sendRequestByHandleAction(handle);
      setMsg(r);
      if (r.notice) {
        setQuery('');
        setResults([]);
      }
    });
  }

  function copyInvite() {
    start(async () => {
      try {
        const { url } = await generateInviteLinkAction();
        await navigator.clipboard.writeText(location.origin + url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setMsg({ error: 'Could not copy invite link.' });
      }
    });
  }

  function block(id: string, name: string) {
    if (!window.confirm(`Block ${name}? They will be removed as a friend and hidden from search.`)) return;
    start(async () => {
      const r = await blockUserActionResult(id);
      setMsg(r);
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <Card>
        <SectionLabel style={{ marginBottom: 12 }}>Add a friend</SectionLabel>
        <Alert kind="error">{msg.error}</Alert>
        <Alert kind="notice">{msg.notice}</Alert>
        <TextField
          label="Search by @handle"
          name="handle"
          placeholder="start typing a handle…"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          autoComplete="off"
        />
        {query.trim().length >= 2 && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {searching && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Searching…</span>}
            {!searching && results.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>No matching users.</span>}
            {results.map((u) => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--r-sm)', background: 'var(--surface-2)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{u.displayName}</div>
                  {u.publicHandle && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>@{u.publicHandle}</div>}
                </div>
                <Btn kind="primary" size="sm" icon="plus" onClick={() => add(u.publicHandle)}>Add</Btn>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Btn kind="soft" size="sm" icon="plus" onClick={copyInvite}>{copied ? 'Copied!' : 'Copy invite link'}</Btn>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Share a link to connect instantly.</span>
        </div>
      </Card>

      {requests.length > 0 && (
        <Card pad={false}>
          <div style={{ padding: 'var(--pad) var(--pad) 0' }}><SectionLabel>Requests</SectionLabel></div>
          {requests.map((r, i) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'var(--row) var(--pad)', borderTop: '1px solid var(--line)', marginTop: i ? 0 : 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>{r.displayName}</div>
                {r.publicHandle && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>@{r.publicHandle}</div>}
              </div>
              <Btn kind="primary" size="sm" onClick={() => start(() => respondFriendAction(r.id, true))}>Accept</Btn>
              <Btn kind="ghost" size="sm" onClick={() => start(() => respondFriendAction(r.id, false))}>Decline</Btn>
            </div>
          ))}
        </Card>
      )}

      <SectionLabel>Friends ({friends.length})</SectionLabel>
      {friends.length === 0 && <Card soft><span style={{ color: 'var(--text-3)' }}>No friends yet — add someone by their handle.</span></Card>}
      {friends.map((f) => (
        <Card key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href={f.publicHandle ? `/app/u/${f.publicHandle}` : '#'} style={{ flex: 1, textDecoration: 'none', color: 'inherit' }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{f.displayName}</div>
            {f.publicHandle && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>@{f.publicHandle}</div>}
          </Link>
          {f.streak ? (
            <Chip accent><Icon name="flame" size={13} stroke={2} /><Mono>{f.streak}</Mono></Chip>
          ) : null}
          <Btn kind="ghost" size="sm" onClick={() => start(() => removeFriendAction(f.id))}>Remove</Btn>
          <Btn kind="ghost" size="sm" onClick={() => block(f.id, f.displayName)} style={{ color: 'var(--text-3)' }}>Block</Btn>
        </Card>
      ))}
    </div>
  );
}
