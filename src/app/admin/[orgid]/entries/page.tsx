'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type Property = { id: string; name: string };

export default function EntriesPage() {
  const p = useParams<{ orgid: string }>();
  const orgId = (p?.orgid ?? '').toString();

  const [props, setProps] = useState<Property[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  // Booking form state
  const [bProp, setBProp] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [bStatus, setBStatus] = useState('confirmed');

  // Ledger form state
  const [lProp, setLProp] = useState('');
  const [kind, setKind] = useState<'revenue'|'expense'>('revenue');
  const [amount, setAmount] = useState('');
  const [occurredOn, setOccurredOn] = useState('');
  const [memo, setMemo] = useState('');

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/orgs/${orgId}/properties/list`, { cache: 'no-store' });
      const j = await res.json();
      if (res.ok) setProps(j.properties || []);
    }
    if (orgId) load();
  }, [orgId]);

  async function createBooking() {
    setMsg('Saving booking…');
    const res = await fetch(`/api/orgs/${orgId}/bookings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property_id: bProp, check_in: checkIn, check_out: checkOut, status: bStatus }),
    });
    const j = await res.json().catch(() => ({}));
    setMsg(res.ok ? `Booking saved (${j.booking?.id || 'ok'})` : `Error ${res.status}: ${j.error || 'failed'}`);
  }

  async function createLedger() {
    setMsg('Saving entry…');
    const res = await fetch(`/api/orgs/${orgId}/ledger`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id: lProp, kind, amount_cents: parseInt(amount, 10), occurred_on: occurredOn, memo
      }),
    });
    const j = await res.json().catch(() => ({}));
    setMsg(res.ok ? `Entry saved (${j.entry?.id || 'ok'})` : `Error ${res.status}: ${j.error || 'failed'}`);
  }

  return (
    <div style={{ maxWidth: 880, margin: '40px auto', padding: '0 16px', fontFamily: 'ui-sans-serif, system-ui' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Admin · Entries</h1>
      <p style={{ color: '#6b7280', marginBottom: 20 }}>Org: <code>{orgId}</code></p>

      {/* Booking form */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Add booking</h2>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))' }}>
          <select value={bProp} onChange={e=>setBProp(e.target.value)} style={{ border:'1px solid #d1d5db', padding:'8px', borderRadius:8 }}>
            <option value="">Select property…</option>
            {props.map(p => <option key={p.id} value={p.id}>{p.name || p.id}</option>)}
          </select>
          <input type="date" value={checkIn} onChange={e=>setCheckIn(e.target.value)}
                 style={{ border:'1px solid #d1d5db', padding:'8px', borderRadius:8 }} />
          <input type="date" value={checkOut} onChange={e=>setCheckOut(e.target.value)}
                 style={{ border:'1px solid #d1d5db', padding:'8px', borderRadius:8 }} />
          <select value={bStatus} onChange={e=>setBStatus(e.target.value)} style={{ border:'1px solid #d1d5db', padding:'8px', borderRadius:8 }}>
            <option value="confirmed">confirmed</option>
            <option value="completed">completed</option>
            <option value="cancelled">cancelled</option>
            <option value="pending">pending</option>
          </select>
        </div>
        <button onClick={createBooking} style={{ marginTop: 12, padding:'8px 12px', borderRadius:8, background:'#111827', color:'#fff' }}>
          Save booking
        </button>
      </div>

      {/* Ledger form */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Add ledger entry</h2>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))' }}>
          <select value={lProp} onChange={e=>setLProp(e.target.value)} style={{ border:'1px solid #d1d5db', padding:'8px', borderRadius:8 }}>
            <option value="">Select property…</option>
            {props.map(p => <option key={p.id} value={p.id}>{p.name || p.id}</option>)}
          </select>
          <select value={kind} onChange={e=>setKind(e.target.value as 'revenue'|'expense')}
                  style={{ border:'1px solid #d1d5db', padding:'8px', borderRadius:8 }}>
            <option value="revenue">revenue</option>
            <option value="expense">expense</option>
          </select>
          <input type="number" placeholder="amount_cents e.g. 62700" value={amount} onChange={e=>setAmount(e.target.value)}
                 style={{ border:'1px solid #d1d5db', padding:'8px', borderRadius:8 }} />
          <input type="date" value={occurredOn} onChange={e=>setOccurredOn(e.target.value)}
                 style={{ border:'1px solid #d1d5db', padding:'8px', borderRadius:8 }} />
          <input type="text" placeholder="memo (optional)" value={memo} onChange={e=>setMemo(e.target.value)}
                 style={{ border:'1px solid #d1d5db', padding:'8px', borderRadius:8 }} />
        </div>
        <button onClick={createLedger} style={{ marginTop: 12, padding:'8px 12px', borderRadius:8, background:'#16A34A', color:'#fff' }}>
          Save ledger entry
        </button>
      </div>

      {msg && <p style={{ marginTop: 16, color:'#374151' }}>{msg}</p>}

      <p style={{ marginTop: 12 }}>
        View member portal: <a href={`/portal/${orgId}`} style={{ textDecoration:'underline' }}>/portal/{orgId}</a>
      </p>
    </div>
  );
}
