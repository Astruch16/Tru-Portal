'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';



type Tier = 'launch' | 'elevate' | 'maximize';
const TIER_LABEL: Record<Tier, string> = {
  launch: 'Launch (12%)',
  elevate: 'Elevate (18%)',
  maximize: 'Maximize (22%)',
};

type Role = 'owner' | 'manager' | 'member';

export default function AdminPage() {
  const p = useParams<{ orgid: string }>();
  const orgId = (p?.orgid ?? '').toString();

  // --- Shared UI state ---
  const [msg, setMsg] = useState<string | null>(null);

  // --- Plan state ---
  const [plan, setPlan] = useState<Tier>('launch');
  const [percent, setPercent] = useState<number>(12);

  // --- Generate state ---
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  // --- Payments state ---
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('0');

  // --- Invite state ---
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('TempPass123!');
  const [inviteRole, setInviteRole] = useState<Role>('member');
  const [busyInvite, setBusyInvite] = useState(false);

  // Load current plan on mount
  useEffect(() => {
    (async () => {
      if (!orgId) return;
      const res = await fetch(`/api/orgs/${orgId}/plan`, { cache: 'no-store' });
      const j = await res.json().catch(() => ({} as Record<string, unknown>));
      const planObj = (j && typeof j === 'object' && j['plan'] && typeof (j as Record<string, unknown>)['plan'] === 'object')
        ? ((j as Record<string, unknown>)['plan'] as Record<string, unknown>)
        : null;

      if (planObj) {
        const t = planObj['tier'];
        const pct = Number(planObj['percent']);
        if (t === 'launch' || t === 'elevate' || t === 'maximize') setPlan(t);
        if (Number.isFinite(pct)) setPercent(pct);
      }
    })();
  }, [orgId]);

  // --- Actions ---
  async function savePlan() {
    if (!orgId) { setMsg('Missing org id in the URL'); return; }
    setMsg('Saving plan…');
    try {
      const res = await fetch(`/api/orgs/${orgId}/plan`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: plan }),
      });
      const j = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) { setMsg(`Plan error ${res.status}: ${(j['error'] as string) || 'failed'}`); return; }
      const pct = Number((j['plan'] as Record<string, unknown> | undefined)?.['percent'] ?? percent);
      setPercent(pct);
      setMsg(`Plan saved: ${plan} (${pct}%)`);
    } catch (e) {
      setMsg(`Network error: ${(e as Error).message}`);
    }
  }

  async function generate() {
    if (!orgId) { setMsg('Missing org id in the URL: visit /admin/<ORG_ID>'); return; }
    setMsg('Generating…');
    try {
      const res = await fetch(`/api/orgs/${orgId}/invoices/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      });
      let jUnknown: unknown = null;
      try { jUnknown = await res.json(); } catch {}
      const j = (jUnknown && typeof jUnknown === 'object') ? (jUnknown as Record<string, unknown>) : {};
      if (!res.ok) { setMsg(`Error ${res.status}: ${(j['error'] as string) || 'Failed to generate'}`); return; }
      const inv = j['invoice'] as { id?: string } | undefined;
      setMsg(`Generated: ${inv?.id || '(no id)'}`);
    } catch (e) { setMsg(`Network error: ${(e as Error).message}`); }
  }

  async function downloadForMonth() {
    if (!orgId) { setMsg('Missing org id in the URL: visit /admin/<ORG_ID>'); return; }
    setMsg('Preparing PDF…');
    try {
      const genRes = await fetch(`/api/orgs/${orgId}/invoices/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      });
      let genUnknown: unknown = null;
      try { genUnknown = await genRes.json(); } catch {}
      const gen = (genUnknown && typeof genUnknown === 'object') ? (genUnknown as Record<string, unknown>) : {};
      if (!genRes.ok) { setMsg(`Generate failed (${genRes.status}): ${(gen['error'] as string) || 'Unknown error'}`); return; }
      const invObj = gen['invoice'] as Record<string, unknown> | undefined;
      const id = (invObj?.['id'] as string) || (gen['id'] as string) || '';
      if (!id) { setMsg('Could not determine invoice id for this month'); return; }

      const linkRes = await fetch(`/api/invoices/${id}/pdf-link`);
      let linkUnknown: unknown = null;
      try { linkUnknown = await linkRes.json(); } catch {}
      const link = (linkUnknown && typeof linkUnknown === 'object') ? (linkUnknown as Record<string, unknown>) : {};
      const url = typeof link['url'] === 'string' ? (link['url'] as string) : '';
      if (!linkRes.ok || !url) { setMsg(`Link error (${linkRes.status}): ${(link['message'] as string) || (link['error'] as string) || 'No URL returned'}`); return; }

      window.open(url, '_blank', 'noopener,noreferrer');
      setMsg('Opened invoice PDF in a new tab.');
    } catch (e) { setMsg(`Download error: ${(e as Error).message}`); }
  }

  async function pay() {
    if (!invoiceId) { setMsg('Enter invoice id'); return; }
    const amt = parseInt(amount, 10);
    if (!Number.isFinite(amt) || amt <= 0) { setMsg('Enter amount_cents > 0'); return; }
    setMsg('Posting payment…');
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_cents: amt, method: 'bank' }),
      });
      const j = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) { setMsg(`Error ${res.status}: ${(j['error'] as string) || 'Failed to record payment'}`); return; }
      setMsg(`Paid. Status: ${(j['invoice'] as Record<string, unknown> | undefined)?.['status'] as string}`);
    } catch (e) { setMsg(`Network error: ${(e as Error).message}`); }
  }

  async function invite() {
    if (!orgId) { setMsg('Missing org id in URL'); return; }
    if (!inviteEmail || !invitePassword) { setMsg('Email and password are required'); return; }
    setBusyInvite(true); setMsg('Creating user…');
    try {
      const res = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          password: invitePassword,
          org_id: orgId,
          role: inviteRole, // owner | manager | member
        }),
      });
      const j = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) {
        setMsg(`Invite error ${res.status}: ${(j['error'] as string) || 'failed'}`);
      } else {
        const uid = (j['user'] as Record<string, unknown> | undefined)?.['id'] as string | undefined;
        setMsg(`User created: ${uid || '(no id)'} — membership linked`);
        setInviteEmail('');
      }
    } catch (e) {
      setMsg(`Network error: ${(e as Error).message}`);
    } finally {
      setBusyInvite(false);
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: '40px auto', padding: '0 16px', fontFamily: 'ui-sans-serif, system-ui' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Admin tools</h1>
      <p style={{ marginBottom: 16 }}>
        <a
          href={`/admin/${orgId}/entries`}
          style={{ padding: '8px 12px', borderRadius: 8, background: '#F3F4F6', color: '#111827', textDecoration: 'none', border: '1px solid #E5E7EB' }}
        >
          Manage Entries
        </a>
        <span style={{ marginLeft: 10, color: '#6b7280' }}>Org: <code>{orgId}</code></span>
      </p>

      {/* Invite member */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Invite member</h2>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
          <input
            placeholder="email"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            style={{ border: '1px solid #d1d5db', padding: '10px', borderRadius: 8 }}
          />
          <input
            placeholder="temporary password"
            type="text"
            value={invitePassword}
            onChange={(e) => setInvitePassword(e.target.value)}
            style={{ border: '1px solid #d1d5db', padding: '10px', borderRadius: 8 }}
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as Role)}
            style={{ border: '1px solid #d1d5db', padding: '10px', borderRadius: 8 }}
          >
            <option value="member">member</option>
            <option value="manager">manager</option>
            <option value="owner">owner</option>
          </select>
        </div>
        <button
          onClick={invite}
          disabled={busyInvite}
          style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: '#111827', color: '#fff' }}
        >
          {busyInvite ? 'Inviting…' : 'Invite member'}
        </button>
        <p style={{ marginTop: 8, color: '#6b7280' }}>
          Creates a Supabase Auth user (confirmed) and links them to this org.
        </p>
      </div>

      {/* Plan */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Plan</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value as Tier)}
            style={{ border: '1px solid #d1d5db', padding: '6px 8px', borderRadius: 8 }}
          >
            <option value="launch">{TIER_LABEL.launch}</option>
            <option value="elevate">{TIER_LABEL.elevate}</option>
            <option value="maximize">{TIER_LABEL.maximize}</option>
          </select>
          <span style={{ color: '#6b7280' }}>
            Current %: <strong>{percent}%</strong>
          </span>
          <button
            onClick={savePlan}
            style={{ padding: '8px 12px', borderRadius: 8, background: '#111827', color: '#fff' }}
          >
            Save plan
          </button>
        </div>
      </div>

      {/* Generate */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Generate invoice</h2>
        <label>Month (YYYY-MM): </label>
        <input
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          style={{ border: '1px solid #d1d5db', padding: '6px 8px', borderRadius: 8, marginRight: 8 }}
        />
        <button
          onClick={generate}
          style={{ padding: '8px 12px', borderRadius: 8, background: '#111827', color: '#fff', marginRight: 8 }}
        >
          Generate
        </button>
        <button
          onClick={downloadForMonth}
          style={{ padding: '8px 12px', borderRadius: 8, background: '#16A34A', color: '#fff' }}
        >
          Download PDF for month
        </button>
      </div>

      {/* Payments */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Record payment</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            placeholder="invoice id…"
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
            style={{ flex: 1, minWidth: 260, border: '1px solid #d1d5db', padding: '6px 8px', borderRadius: 8 }}
          />
          <input
            placeholder="amount_cents (e.g. 62700)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ width: 220, border: '1px solid #d1d5db', padding: '6px 8px', borderRadius: 8 }}
          />
          <button
            onClick={pay}
            style={{ padding: '8px 12px', borderRadius: 8, background: '#2563EB', color: '#fff' }}
          >
            Add payment
          </button>
        </div>
      </div>

      {msg && <p style={{ marginTop: 16, color: '#374151' }}>{msg}</p>}
    </div>
  );
}
