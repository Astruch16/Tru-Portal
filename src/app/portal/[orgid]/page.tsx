// src/app/portal/[orgid]/page.tsx
export const dynamic = 'force-dynamic';

import PortalClient from '@/components/portal/PortalClient';

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

type Property = {
  id: string;
  name: string;
};

// ----- Helpers -----
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
function isProperty(v: unknown): v is Property {
  if (!isRecord(v)) return false;
  return typeof v.id === 'string' && typeof v.name === 'string';
}

// ----- Page (Server Component) -----
export default async function PortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgid: string }>;
  searchParams?: Promise<{ month?: string }>;
}) {
  const { orgid } = await params;
  const search = await searchParams;
  const orgId = orgid;
  const ym = (search?.month ?? new Date().toISOString().slice(0, 7)).slice(0, 7);
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  // Plan - fetch with authentication to get user-specific plan
  let plan: Plan | null = null;
  try {
    const { supabaseServer } = await import('@/lib/supabase/server');
    const sb = await supabaseServer();
    const { data: { session } } = await sb.auth.getSession();

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const planUrl = `${base}/api/orgs/${orgId}/plan`;
    console.log('Portal page - Fetching plan from:', planUrl);
    const pr = await fetch(planUrl, {
      cache: 'no-store',
      headers
    });
    console.log('Portal page - Plan response status:', pr.status);
    const pj = await pr.json().catch(() => ({}));
    console.log('Portal page - Plan response body:', pj);
    const p = isRecord(pj) && isRecord((pj as Record<string, unknown>).plan) ? (pj as Record<string, unknown>).plan : null;
    if (p && isPlan(p)) plan = p;
    console.log('Portal page - Final plan:', plan);
  } catch (e) {
    console.log('Portal page - Plan fetch error:', e);
    plan = null;
  }

  // KPIs - fetch with authentication to get user-specific KPIs
  let k: KPI | null = null;
  try {
    const { supabaseServer } = await import('@/lib/supabase/server');
    const sb = await supabaseServer();
    const { data: { session } } = await sb.auth.getSession();

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const kpiRes = await fetch(`${base}/api/kpis?org=${orgId}&month=${ym}`, {
      cache: 'no-store',
      headers
    });
    const kpiJson = await kpiRes.json();
    let list: unknown[] = [];
    if (isRecord(kpiJson) && Array.isArray((kpiJson as { kpis?: unknown[] }).kpis)) {
      list = (kpiJson as { kpis?: unknown[] }).kpis as unknown[];
    }
    const filtered = list.filter(isKPI);
    k = filtered[0] ?? null;
  } catch { k = null; }

  // Invoices - fetch entire year with authentication to get user-specific invoices
  const currentYear = new Date().getFullYear();
  let invoices: Invoice[] = [];
  try {
    const { supabaseServer } = await import('@/lib/supabase/server');
    const sb = await supabaseServer();
    const { data: { session } } = await sb.auth.getSession();

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const invRes = await fetch(`${base}/api/orgs/${orgId}/invoices/list?from=${currentYear}-01&to=${currentYear}-12`, {
      cache: 'no-store',
      headers
    });
    const invJson = await invRes.json();
    let invList: unknown[] = [];
    if (isRecord(invJson) && Array.isArray((invJson as { invoices?: unknown[] }).invoices)) {
      invList = (invJson as { invoices?: unknown[] }).invoices as unknown[];
    }
    invoices = invList.filter(isInvoice);
  } catch { invoices = []; }

  // Properties - fetch with authentication to get user-specific properties
  let properties: Property[] = [];
  try {
    const { supabaseServer } = await import('@/lib/supabase/server');
    const sb = await supabaseServer();
    const { data: { session } } = await sb.auth.getSession();

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const propRes = await fetch(`${base}/api/orgs/${orgId}/properties/list`, {
      cache: 'no-store',
      headers
    });
    const propJson = await propRes.json();
    let propList: unknown[] = [];
    if (isRecord(propJson) && Array.isArray((propJson as { properties?: unknown[] }).properties)) {
      propList = (propJson as { properties?: unknown[] }).properties as unknown[];
    }
    properties = propList.filter(isProperty);
  } catch { properties = []; }

  return <PortalClient orgId={orgId} month={ym} kpi={k} invoices={invoices} plan={plan} properties={properties} />;
}
