'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabaseClient } from '@/lib/supabase/client';

function ResetPasswordForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const sb = supabaseClient();

  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<string>('Verifying link…');
  const [busy, setBusy] = useState(false);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');

  useEffect(() => {
    (async () => {
      try {
        // Newer Supabase links include ?code=...
        const code = sp.get('code');
        if (code) {
          const { error } = await sb.auth.exchangeCodeForSession(code);
          if (error) {
            setMsg(`Invalid or expired link: ${error.message}`);
            setReady(false);
            return;
          }
          setMsg('Link verified. Set your new password.');
          setReady(true);
          return;
        }

        // Fallback: if a session is already present
        const { data: { user } } = await sb.auth.getUser();
        if (user) {
          setMsg('Set your new password.');
          setReady(true);
          return;
        }

        setMsg('Invalid or expired link. Please request a new reset email.');
        setReady(false);
      } catch (e) {
        setMsg((e as Error).message);
        setReady(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    if (pw1.length < 8) { setMsg('Password must be at least 8 characters.'); return; }
    if (pw1 !== pw2) { setMsg('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const { error } = await sb.auth.updateUser({ password: pw1 });
      if (error) { setMsg(error.message); setBusy(false); return; }
      setMsg('Password updated. Redirecting to sign in…');
      setTimeout(() => router.replace('/login'), 900);
    } catch (e) {
      setMsg((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '80px auto', padding: 16, fontFamily: 'ui-sans-serif, system-ui' }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Reset your password</h1>
      <p style={{ color: '#6b7280', marginBottom: 16 }}>{msg}</p>

      {ready && (
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
          <input
            type="password"
            placeholder="New password"
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
            style={{ border: '1px solid #d1d5db', padding: 10, borderRadius: 8 }}
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            style={{ border: '1px solid #d1d5db', padding: 10, borderRadius: 8 }}
          />
          <button
            type="submit"
            disabled={busy}
            style={{ padding: '10px 12px', borderRadius: 8, background: '#111827', color: '#fff' }}
          >
            {busy ? 'Updating…' : 'Update password'}
          </button>
        </form>
      )}

      <p style={{ marginTop: 16 }}>
        <a href="/login" style={{ color: '#2563EB' }}>Back to sign in</a>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{ maxWidth: 420, margin: '80px auto', padding: 16, fontFamily: 'ui-sans-serif, system-ui' }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Reset your password</h1>
        <p style={{ color: '#6b7280' }}>Loading...</p>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
