'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
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
import { Icon, Mono, SectionLabel, useToast } from '@/components/ui';
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

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: 'var(--r-pill)',
        background: 'var(--surface-2)',
        border: '1px solid var(--line)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: size * 0.34,
        fontWeight: 700,
        color: 'var(--text-2)',
        flexShrink: 0,
      }}
    >
      {initials(name)}
    </span>
  );
}

export function FriendsManager({
  friends,
  requests,
  searchable = true,
}: {
  friends: FriendLite[];
  requests: FriendLite[];
  searchable?: boolean;
}) {
  const t = useTranslations('friends');
  const [, start] = useTransition();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; notice?: string }>({});
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [requesting, setRequesting] = useState<string | null>(null);
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
        if (mine === seq.current)
          setResults(hits.map((h) => ({ id: h.id, displayName: h.displayName, publicHandle: h.publicHandle })));
      } finally {
        if (mine === seq.current) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  function add(hit: SearchHit) {
    if (!hit.publicHandle) return;
    setRequesting(hit.id);
    start(async () => {
      const r = await sendRequestByHandleAction(hit.publicHandle!);
      setRequesting(null);
      if (r.error) {
        setMsg({ error: r.error });
        toast(r.error, 'error');
      } else {
        // Optimistic: flip this row to "Requested" instead of clearing the search.
        setRequested((prev) => new Set(prev).add(hit.id));
        setMsg({});
        toast(t('sent'), 'success');
      }
    });
  }

  function copyInvite() {
    start(async () => {
      try {
        const { url } = await generateInviteLinkAction();
        await navigator.clipboard.writeText(location.origin + url);
        setCopied(true);
        toast(t('inviteCopied'), 'success');
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast(t('inviteCopyFailed'), 'error');
      }
    });
  }

  function remove(id: string, name: string) {
    if (!window.confirm(t('confirmRemove', { name }))) return;
    start(async () => {
      await removeFriendAction(id);
      toast(t('removed', { name }), 'info');
    });
  }

  function block(id: string, name: string) {
    if (!window.confirm(t('confirmBlock', { name }))) return;
    start(async () => {
      const r = await blockUserActionResult(id);
      if (r.notice) toast(r.notice, 'info');
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <Card>
        <SectionLabel style={{ marginBottom: 12 }}>{t('addFriend')}</SectionLabel>
        <Alert kind="error">{msg.error}</Alert>
        <Alert kind="notice">{msg.notice}</Alert>
        <TextField
          label={t('searchLabel')}
          name="handle"
          placeholder={t('searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          autoComplete="off"
        />
        {query.trim().length >= 2 && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {searching && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{t('searching')}</span>}
            {!searching && results.length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                {t('noMatches')}
              </span>
            )}
            {results.map((u) => {
              const isReq = requested.has(u.id);
              return (
                <div
                  key={u.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 'var(--r-sm)',
                    background: 'var(--surface-2)',
                  }}
                >
                  <Avatar name={u.displayName} size={34} />
                  <Link
                    href={u.publicHandle ? `/app/u/${u.publicHandle}` : '#'}
                    style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.displayName}
                    </div>
                    {u.publicHandle && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>@{u.publicHandle}</div>}
                  </Link>
                  {isReq ? (
                    <Chip>{t('requested')}</Chip>
                  ) : (
                    <Btn kind="primary" size="sm" icon="plus" onClick={() => add(u)} disabled={requesting === u.id}>
                      {requesting === u.id ? '…' : t('add')}
                    </Btn>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Btn kind="soft" size="sm" icon="link" onClick={copyInvite}>{copied ? t('copied') : t('copyInvite')}</Btn>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{t('shareHint')}</span>
        </div>
        {!searchable && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-3)' }}>
            {t('notSearchable')}{' '}
            <Link href="/app/settings/privacy" style={{ color: 'var(--accent-text)' }}>{t('changeInPrivacy')}</Link>.
          </div>
        )}
      </Card>

      {requests.length > 0 && (
        <Card pad={false}>
          <div style={{ padding: 'var(--pad) var(--pad) 0' }}>
            <SectionLabel>{t('requestsCount', { count: requests.length })}</SectionLabel>
          </div>
          {requests.map((r, i) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'var(--row) var(--pad)', borderTop: '1px solid var(--line)', marginTop: i ? 0 : 10 }}>
              <Avatar name={r.displayName} size={36} />
              <Link href={r.publicHandle ? `/app/u/${r.publicHandle}` : '#'} style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>{r.displayName}</div>
                {r.publicHandle && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>@{r.publicHandle}</div>}
              </Link>
              <Btn kind="primary" size="sm" onClick={() => start(() => respondFriendAction(r.id, true))}>{t('accept')}</Btn>
              <Btn kind="ghost" size="sm" onClick={() => start(() => respondFriendAction(r.id, false))}>{t('decline')}</Btn>
            </div>
          ))}
        </Card>
      )}

      <SectionLabel>{t('friendsCount', { count: friends.length })}</SectionLabel>
      {friends.length === 0 && (
        <Card soft>
          <span style={{ color: 'var(--text-3)' }}>{t('none')}</span>
        </Card>
      )}
      {friends.map((f) => (
        <Card key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar name={f.displayName} size={38} />
          <Link href={f.publicHandle ? `/app/u/${f.publicHandle}` : '#'} style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{f.displayName}</div>
            {f.publicHandle && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>@{f.publicHandle}</div>}
          </Link>
          {f.streak ? (
            <Chip accent><Icon name="flame" size={13} stroke={2} /><Mono>{f.streak}</Mono></Chip>
          ) : null}
          <Btn kind="ghost" size="sm" onClick={() => remove(f.id, f.displayName)}>{t('remove')}</Btn>
          <Btn kind="ghost" size="sm" onClick={() => block(f.id, f.displayName)} style={{ color: 'var(--text-3)' }}>{t('block')}</Btn>
        </Card>
      ))}
    </div>
  );
}
