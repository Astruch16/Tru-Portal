import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function extractUUID(s: string | undefined | null) {
  if (!s) return null;
  const m = s.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  return m ? m[0].toLowerCase() : null;
}

export async function POST(req: NextRequest, { params }: { params: { orgid?: string } }) {
  const url = new URL(req.url);

  // org id from path, query (?org=), or body { org }
  const pathOrg = extractUUID(params?.orgid ?? '');
  let bodyObj: Record<string, unknown> = {};
  try { bodyObj = await req.json(); } catch { /* no body */ }
  const bodyOrg = extractUUID(typeof bodyObj.org === 'string' ? (bodyObj.org as string) : null);
  const queryOrg = extractUUID(url.searchParams.get('org'));
  const orgId = pathOrg ?? queryOrg ?? bodyOrg;

  if (!orgId) {
    return NextResponse.json(
      { error: 'No org id. Provide as path /api/orgs/{uuid}/..., or ?org=UUID, or body { "org": "UUID" }' },
      { status: 400 }
    );
  }

  // month from body, query (?month=YYYY-MM), or default to current
  const bodyMonth = typeof bodyObj.month === 'string' ? (bodyObj.month as string) : undefined;
  const queryMonth = url.searchParams.get('month') ?? undefined;
  const ym = (bodyMonth || queryMonth || new Date().toISOString().slice(0, 7)).slice(0, 7);
  const monthDate = `${ym}-01`;

  // Supabase admin client
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }
  const admin = createClient(supaUrl, serviceKey);

  // Use the SAFE wrapper that always returns the invoice row
  const { data, error } = await admin.rpc('api_admin_generate_monthly_invoice_safe', {
    p_org_id: orgId,
    p_month: monthDate,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, invoice: data ?? null, orgId, month: monthDate });
}

