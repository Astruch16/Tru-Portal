// src/app/portal/[orgid]/page.tsx
export const dynamic = 'force-dynamic';

// ----- Types -----
type KPI = {
  org_id: string;
  month: string;
  gross_revenue_cents: number;
  expenses_cents: number;
  net_revenue_cents: number;
  nights_booked: number;
  properties: number;
  occupancy_rate: number;
  vacancy_rate: number;
};

type Invoice = {
  id: string;
  invoice_number: string | null;
  bill_month: string;
  amount_due_cents: number | null;
  status: 'due' | 'paid' | 'void';
};

type Plan = { tier: 'launch' | 'elevate' | 'maximize'; percent: number };

// ----- Helpers -----
function money(cents?: number | null) {
  const v = ((cents ?? 0) / 100).toFixed(2);
  return `$${v} CAD`;
}
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
function isKPI(v: unknown): v is KPI {
  if (!isRecord(v)) return false;
  return (
    typeof v.org_id === 'string' &&
    typeof v.month === 'string' &&
    typeof v.gross_revenue_cents === 'number' &&
    typeof v.expenses_cents === 'number' &&
    typeof v.net_revenue_cents === 'number' &&
    typeof v.nights_booked === 'number' &&
    typeof v.properties === 'number' &&
    typeof v.occupancy_rate === 'number' &&
    typeof v.vacancy_rate === 'number'
  );
}
function isInvoice(v: unknown): v is Invoice {
  if (!isRecord(v)) return false;
  const s = v.status;
  const ok = s === 'due' || s === 'paid' || s === 'void';
  return (
    typeof v.id === 'string' &&
    typeof v.bill_month === 'string' &&
    (typeof v.invoice_number === 'string' || v.invoice_number === null || typeof v.invoice_number === 'undefined') &&
    (typeof v.amount_due_cents === 'number' || v.amount_due_cents === null || typeof v.amount_due_cents === 'undefined') &&
    ok
  );
}
function isPlan(v: unknown): v is Plan {
  if (!isRecord(v)) return false;
  const t = v.tier;
  const okTier = t === 'launch' || t === 'elevate' || t === 'maximize';
  return okTier && typeof v.percent === 'number';
}

// ----- Page (Server Component) -----
export default async function PortalPage({
  params,
  searchParams,
}: {
  params: { orgid: string };
  searchParams?: { month?: string };
}) {
  const orgId = params.orgid;
  const ym = (searchParams?.month ?? new Date().toISOString().slice(0, 7)).slice(0, 7);
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  // Plan
  let plan: Plan | null = null;
  try {
    const pr = await fetch(`${base}/api/orgs/${orgId}/plan`, { cache: 'no-store' });
    const pj = await pr.json().catch(() => ({}));
    const p = isRecord(pj) && isRecord((pj as Record<string, unknown>).plan) ? (pj as Record<string, unknown>).plan : null;
    if (p && isPlan(p)) plan = p;
  } catch { plan = null; }

  // KPIs
  const kpiRes = await fetch(`${base}/api/kpis?org=${orgId}&month=${ym}`, { cache: 'no-store' });
  let k: KPI | null = null;
  try {
    const kpiJson = await kpiRes.json();
    let list: unknown[] = [];
    if (isRecord(kpiJson) && Array.isArray((kpiJson as { kpis?: unknown[] }).kpis)) {
      list = (kpiJson as { kpis?: unknown[] }).kpis as unknown[];
    }
    const filtered = list.filter(isKPI);
    k = filtered[0] ?? null;
  } catch { k = null; }

  // Invoices
  const invRes = await fetch(`${base}/api/orgs/${orgId}/invoices/list?from=${ym}&to=${ym}`, { cache: 'no-store' });
  let invoices: Invoice[] = [];
  try {
    const invJson = await invRes.json();
    let invList: unknown[] = [];
    if (isRecord(invJson) && Array.isArray((invJson as { invoices?: unknown[] }).invoices)) {
      invList = (invJson as { invoices?: unknown[] }).invoices as unknown[];
    }
    invoices = invList.filter(isInvoice);
  } catch { invoices = []; }

  return (
    <div style={{ maxWidth: 980, margin: '40px auto', padding: '0 16px', fontFamily: 'ui-sans-serif, system-ui' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Member Portal</h1>
      <p style={{ color: '#555', marginBottom: 8 }}>
        Org: <code>{orgId}</code> — Month: <strong>{ym}</strong>
      </p>
      {plan && (
        <p style={{ color: '#111827', marginBottom: 24 }}>
          Plan: <strong style={{ textTransform: 'capitalize' }}>{plan.tier}</strong> ({plan.percent}%)
        </p>
      )}

      {/* KPI cards */}
      {k ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginBottom: 28 }}>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Gross Revenue</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{money(k.gross_revenue_cents)}</div>
          </div>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Expenses</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{money(k.expenses_cents)}</div>
          </div>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Net Revenue</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{money(k.net_revenue_cents)}</div>
          </div>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Nights Booked</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{k.nights_booked}</div>
          </div>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Occupancy</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{(k.occupancy_rate * 100).toFixed(1)}%</div>
          </div>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Vacancy</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{(k.vacancy_rate * 100).toFixed(1)}%</div>
          </div>
        </div>
      ) : (
        <p style={{ color: '#9ca3af' }}>No KPI data.</p>
      )}

      {/* Invoices */}
      <h2 style={{ fontSize: 22, margin: '8px 0 12px' }}>Invoices</h2>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f9fafb' }}>
            <tr>
              <th style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #e5e7eb' }}>Invoice #</th>
              <th style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #e5e7eb' }}>Month</th>
              <th style={{ textAlign: 'right', padding: 12, borderBottom: '1px solid #e5e7eb' }}>Amount</th>
              <th style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #e5e7eb' }}>Status</th>
              <th style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #e5e7eb' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 16, color: '#9ca3af' }}>No invoices for {ym}.</td>
              </tr>
            )}
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td style={{ padding: 12, borderBottom: '1px solid #f3f4f6' }}>
                  {inv.invoice_number ?? inv.id}
                </td>
                <td style={{ padding: 12, borderBottom: '1px solid #f3f4f6' }}>{inv.bill_month}</td>
                <td style={{ padding: 12, borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>
                  {money(inv.amount_due_cents)}
                </td>
                <td style={{ padding: 12, borderBottom: '1px solid #f3f4f6' }}>{inv.status.toUpperCase()}</td>
                <td style={{ padding: 12, borderBottom: '1px solid #f3f4f6' }}>
                  <a href={`/api/invoices/${inv.id}/pdf`} style={{ marginRight: 12 }}>PDF</a>
                  <a href={`/api/invoices/${inv.id}/pdf-link`}>Signed link</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 14, color: '#6b7280' }}>
        Tip: add <code>?month=YYYY-MM</code> to the URL to switch months.
      </p>
    </div>
  );
}
