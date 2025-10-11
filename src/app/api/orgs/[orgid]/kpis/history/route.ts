// src/app/api/orgs/[orgid]/kpis/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function extractUUID(s: string | undefined | null) {
  if (!s) return null;
  const m = s.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  return m ? m[0].toLowerCase() : null;
}

export async function GET(req: NextRequest, { params }: { params: { orgid?: string } }) {
  const url = new URL(req.url);
  const orgId = extractUUID(params?.orgid ?? '');

  if (!orgId) {
    return NextResponse.json({ error: 'Missing or invalid org id' }, { status: 400 });
  }

  // Get number of months to fetch (default 12)
  const months = parseInt(url.searchParams.get('months') || '12', 10);
  const validMonths = Math.min(Math.max(months, 1), 36); // Limit between 1-36 months

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supaUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }

  const admin = createClient(supaUrl, serviceKey);

  // Call the RPC function to get historical KPIs
  const { data, error } = await admin.rpc('api_get_org_kpis_history', {
    p_org_id: orgId,
    p_months: validMonths,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, kpis: data || [], orgId });
}
