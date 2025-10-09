'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseClient } from '@/lib/supabase/client';

type Membership = { org_id: string; role: string | null };

export default function LoginPage() {
  const sb = supabaseClient();
  const router = useRouter();
  const sp = useSearchParams();
  const redirect = sp.get('redirect') || '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('Signing in…');

    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { setMsg(error.message); setBusy(false); return; }

    // Find user's org (relies on RLS policy below)
    const { data, error: mErr } = await sb
      .from('org_memberships')
      .select('org_id, role')
      .limit(1);

    if (mErr) { setMsg(mErr.message); setBusy(false); return; }

    const orgId = (data && (data[0] as Membership | undefined)?.org_id) || '';
    setMsg('Signed in.');

    if (redirect) router.replace(redirect);
    else if (orgId) router.replace(`/portal/${orgId}`);
    else router.replace('/');

    setBusy(false);
  }

  return (
    <div style={{ maxWidth: 420, margin: '80px auto', padding: 16, fontFamily: 'ui-sans-serif, system-ui' }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Sign in</h1>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
        <input
          type="email" placeholder="you@example.com" value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ border: '1px solid #d1d5db', padding: '10px', borderRadius: 8 }}
          required
        />
        <input
          type="password" placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ border: '1px solid #d1d5db', padding: '10px', borderRadius: 8 }}
          required
        />
        <button
          type="submit" disabled={busy}
          style={{ padding: '10px 12px', borderRadius: 8, background: '#111827', color: '#fff' }}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p style={{ marginTop: 10 }}>
  <a href="/forgot" style={{ color: '#2563EB' }}>Forgot your password?</a>
</p>
      </form>
      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </div>
  );
}
