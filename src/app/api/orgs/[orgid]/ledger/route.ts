import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';

function uuidOf(s?: string | null) {
  if (!s) return null;
  const m = s.match(/[0-9a-fA-F-]{36}/);
  return m ? m[0].toLowerCase() : null;
}
function isDate(s?: unknown) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
function kindOf(s?: unknown) {
  const v = typeof s === 'string' ? s.toLowerCase() : '';
  // If your column is enum entry_kind, Supabase accepts string values matching enum labels
  return v === 'expense' ? 'expense' : 'revenue';
}

export async function POST(req: NextRequest, { params }: { params: { orgid?: string } }) {
  const orgId = uuidOf(params?.orgid);
  if (!orgId) return NextResponse.json({ error: 'Bad org id' }, { status: 400 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}
  const property_id   = uuidOf(body.property_id as string);
  const kind          = kindOf(body.kind);
  const amount_cents  = typeof body.amount_cents === 'string' ? Number(body.amount_cents) : Number(body.amount_cents);
  const occurred_on   = body.occurred_on;
  const memo          = typeof body.memo === 'string' ? body.memo : null;

  if (!property_id) return NextResponse.json({ error: 'property_id required' }, { status: 400 });
  if (!Number.isInteger(amount_cents) || amount_cents <= 0) {
    return NextResponse.json({ error: 'amount_cents must be a positive integer' }, { status: 400 });
  }
  if (!isDate(occurred_on)) {
    return NextResponse.json({ error: 'occurred_on must be YYYY-MM-DD' }, { status: 400 });
  }

  // Pick any org member as created_by (so your NOT NULL constraint is happy)
  const admin = createClient(url, key);
  const member = await admin
    .from('org_memberships')
    .select('user_id')
    .eq('org_id', orgId)
    .limit(1)
    .maybeSingle();

  const created_by = member.data?.user_id ?? null;

  const { data, error } = await admin
    .from('ledger_entries')
    .insert([{ org_id: orgId, property_id, kind, amount_cents, occurred_on, memo, created_by }])
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, entry: data });
}
