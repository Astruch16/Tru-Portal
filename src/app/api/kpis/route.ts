// src/app/api/kpis/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';

function extractUUID(s: string | null) {
  if (!s) return null;
  const m = s.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  return m ? m[0].toLowerCase() : null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const orgId = extractUUID(url.searchParams.get('org'));
  const month = (url.searchParams.get('month') ?? new Date().toISOString().slice(0,7)) + '-01';
  if (!orgId) return NextResponse.json({ error: 'Missing or bad ?org=UUID' }, { status: 400 });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data, error } = await admin.rpc('api_get_org_month_kpis', {
    p_org_id: orgId,
    p_month: month,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, kpis: data });
}
