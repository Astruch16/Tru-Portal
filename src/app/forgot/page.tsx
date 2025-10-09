'use client';

import { useState } from 'react';
import { supabaseClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const sb = supabaseClient();
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('Sending reset email…');
    try {
      const redirectTo = `${window.location.origin}/reset`;
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) setMsg(error.message);
      else setMsg('If that email exists, a reset link has been sent.');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '80px auto', padding: 16, fontFamily: 'ui-sans-serif, system-ui' }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Forgot your password?</h1>
      <p style={{ color: '#6b7280', marginBottom: 16 }}>
        Enter your email and we’ll send you a reset link.
      </p>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ border: '1px solid #d1d5db', padding: 10, borderRadius: 8 }}
        />
        <button
          type="submit"
          disabled={busy}
          style={{ padding: '10px 12px', borderRadius: 8, background: '#111827', color: '#fff' }}
        >
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
      <p style={{ marginTop: 16 }}>
        <a href="/login" style={{ color: '#2563EB' }}>Back to sign in</a>
      </p>
    </div>
  );
}

