import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';

function uuidOf(s?: string | null) {
  if (!s) return null;
  const m = s.match(/[0-9a-fA-F-]{36}/);
  return m ? m[0].toLowerCase() : null;
}
function isDate(s?: unknown) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
function statusOf(s?: unknown) {
  const v = typeof s === 'string' ? s.toLowerCase() : '';
  return ['confirmed','completed','cancelled','pending'].includes(v) ? v : 'confirmed';
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgid?: string }> }) {
  const { orgid } = await params;
  const orgId = uuidOf(orgid);
  if (!orgId) return NextResponse.json({ error: 'Bad org id' }, { status: 400 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });

  const admin = createClient(url, key);
  const { data, error } = await admin
    .from('bookings')
    .select('*, properties(name)')
    .eq('org_id', orgId)
    .order('check_in', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, bookings: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgid?: string }> }) {
  const { orgid } = await params;
  const orgId = uuidOf(orgid);
  if (!orgId) return NextResponse.json({ error: 'Bad org id' }, { status: 400 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}
  const property_id = uuidOf(body.property_id as string);
  const check_in    = body.check_in;
  const check_out   = body.check_out;
  const status      = statusOf(body.status);

  if (!property_id) return NextResponse.json({ error: 'property_id required' }, { status: 400 });
  if (!isDate(check_in) || !isDate(check_out)) {
    return NextResponse.json({ error: 'check_in and check_out must be YYYY-MM-DD' }, { status: 400 });
  }

  const admin = createClient(url, key);
  const { data, error } = await admin
    .from('bookings')
    .insert([{ org_id: orgId, property_id, check_in, check_out, status }])
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, booking: data });
}
