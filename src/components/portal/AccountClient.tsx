'use client';

import { useEffect, useState } from 'react';

type Plan = { tier: string; percent: number };
type Property = { id: string; airbnb_name: string | null };
type Profile = { first_name: string; last_name: string; avatar_url: string };

export default function AccountClient({ orgId }: { orgId: string }) {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile>({ first_name: '', last_name: '', avatar_url: '' });
  const [plan, setPlan] = useState<Plan | null>(null);
  const [propsList, setPropsList] = useState<Property[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingNames, setSavingNames] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg('Loading…');
      try {
        const res = await fetch(`/api/orgs/${orgId}/profile`, { cache: 'no-store' });
        const j = await res.json();
        if (!res.ok) {
          setMsg(`Error ${res.status}: ${j?.error || 'failed'}`);
        } else {
          setProfile(j.profile as Profile);
          setPlan(j.plan as Plan | null);
          setPropsList(j.properties as Property[]);
          setMsg(null);
        }
      } catch (e) {
        setMsg((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [orgId]);

  async function saveNames() {
    setSavingNames(true);
    setMsg('Saving property names…');
    try {
      const updates = propsList
        .filter((x) => x.airbnb_name && x.airbnb_name.trim().length > 0)
        .map((x) => ({ id: x.id, airbnb_name: x.airbnb_name!.trim() }));
      const res = await fetch(`/api/orgs/${orgId}/properties/names`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(`Error ${res.status}: ${j?.error || 'failed'}`); }
      else setMsg(`Saved ${j?.count ?? updates.length} properties.`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSavingNames(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    setMsg('Saving profile…');
    try {
      const res = await fetch(`/api/orgs/${orgId}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: profile.first_name, last_name: profile.last_name }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(`Error ${res.status}: ${j?.error || 'failed'}`); }
      else setMsg('Profile saved.');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar() {
    if (!file) { setMsg('Choose an image first.'); return; }
    setMsg('Uploading avatar…');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/orgs/${orgId}/profile/avatar`, { method: 'POST', body: form });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(`Upload error ${res.status}: ${j?.error || 'failed'}`); return; }
      setProfile((prev) => ({ ...prev, avatar_url: String(j.avatar_url || prev.avatar_url) }));
      setMsg('Avatar updated.');
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 16px', fontFamily: 'ui-sans-serif, system-ui' }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Account</h1>

      {msg && <p style={{ marginBottom: 12, color: '#374151' }}>{msg}</p>}
      {loading ? <p>Loading…</p> : (
        <>
          {/* Profile card */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>Profile</h2>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div style={{ width: 96, height: 96, borderRadius: '50%', overflow: 'hidden', background: '#f3f4f6' }}>
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#9ca3af' }}>
                      no avatar
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 8 }}>
                  <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  <button onClick={uploadAvatar} style={{ marginLeft: 8, padding: '6px 10px', borderRadius: 8, background: '#111827', color: '#fff' }}>
                    Upload
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ display:'grid', gap: 8 }}>
                  <input
                    placeholder="First name"
                    value={profile.first_name}
                    onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                    style={{ border:'1px solid #d1d5db', padding:'8px', borderRadius:8 }}
                  />
                  <input
                    placeholder="Last name"
                    value={profile.last_name}
                    onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                    style={{ border:'1px solid #d1d5db', padding:'8px', borderRadius:8 }}
                  />
                </div>
                <button
                  onClick={saveProfile}
                  disabled={saving}
                  style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: '#111827', color: '#fff' }}
                >
                  {saving ? 'Saving…' : 'Save profile'}
                </button>
              </div>

              <div style={{ minWidth: 220 }}>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Plan</div>
                {plan ? (
                  <div style={{ fontSize: 16, marginTop: 4 }}>
                    <strong style={{ textTransform: 'capitalize' }}>{plan.tier}</strong> — {plan.percent}%
                  </div>
                ) : (
                  <div style={{ color: '#6b7280' }}>No plan found</div>
                )}
              </div>
            </div>
          </div>

          {/* Properties card */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>Properties (Airbnb names)</h2>
            {propsList.length === 0 ? (
              <p style={{ color:'#6b7280' }}>No properties yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {propsList.map((pr, i) => (
                  <div key={pr.id} style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <div style={{ width: 16, textAlign:'right', color:'#9ca3af' }}>{i+1}.</div>
                    <input
                      value={pr.airbnb_name ?? ''}
                      placeholder="Airbnb listing name"
                      onChange={(e) => {
                        const v = e.target.value;
                        setPropsList((prev) => prev.map((x) => x.id === pr.id ? { ...x, airbnb_name: v } : x));
                      }}
                      style={{ flex:1, minWidth: 200, border:'1px solid #d1d5db', padding:'8px', borderRadius:8 }}
                    />
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={saveNames}
              disabled={savingNames}
              style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: '#16A34A', color: '#fff' }}
            >
              {savingNames ? 'Saving…' : 'Save names'}
            </button>
            <p style={{ marginTop: 8, color:'#6b7280' }}>
              These names appear on invoices & dashboards instead of street addresses.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
