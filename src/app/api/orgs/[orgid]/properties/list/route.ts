import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';

function uuidOf(s?: string | null) {
  if (!s) return null;
  const m = s.match(/[0-9a-fA-F-]{36}/);
  return m ? m[0].toLowerCase() : null;
}

export async function GET(_req: NextRequest, { params }: { params: { orgid?: string } }) {
  const orgId = uuidOf(params?.orgid);
  if (!orgId) return NextResponse.json({ error: 'Bad org id' }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });

  const admin = createClient(url, key);
  const { data, error } = await admin
    .from('properties')
    .select('id, name')
    .eq('org_id', orgId)
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, properties: data ?? [] });
}
