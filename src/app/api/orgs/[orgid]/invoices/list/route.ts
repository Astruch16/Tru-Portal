import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function uuidOf(s?: string | null) {
  if (!s) return null;
  const m = s.match(/[0-9a-fA-F-]{36}/);
  return m ? m[0].toLowerCase() : null;
}

function toMonthStart(ym?: string | null): string {
  // Accept "YYYY-MM" or "YYYY-MM-DD", fallback to current month
  const iso = (ym && ym.length >= 7 ? ym : new Date().toISOString().slice(0, 7)).slice(0, 7);
  return `${iso}-01`;
}

function addOneMonth(ymd: string): string {
  const d = new Date(ymd + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgid?: string }> }) {
  const { orgid } = await params;
  const orgId = uuidOf(orgid);
  if (!orgId) return NextResponse.json({ error: 'Bad org id' }, { status: 400 });

  const url = new URL(req.url);
  const fromYm = url.searchParams.get('from');
  const toYm   = url.searchParams.get('to');

  const from = toMonthStart(fromYm);
  const to   = toMonthStart(toYm);
  const toExclusive = addOneMonth(to); // end-exclusive range upper bound

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !service) return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });

  const admin = createClient(supaUrl, service);

  // Check if this request is from a member portal (has auth header)
  const authHeader = req.headers.get('authorization');
  let userId: string | null = null;

  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await admin.auth.getUser(token);

    if (user) {
      userId = user.id;

      // Check if user has any assigned properties
      const { data: userProperties } = await admin
        .from('user_properties')
        .select('property_id')
        .eq('user_id', userId);

      // If user has no assigned properties, return empty invoices
      if (!userProperties || userProperties.length === 0) {
        return NextResponse.json({ ok: true, invoices: [] });
      }
    }
  }

  let query = admin
    .from('invoices')
    .select('id, invoice_number, bill_month, amount_due_cents, status, property_id, user_id')
    .eq('org_id', orgId);

  // If authenticated member, filter to only their invoices
  if (userId) {
    query = query.eq('user_id', userId);
  }

  query = query.order('bill_month', { ascending: false });

  // If from == to, just eq that month; else use [from, to+1month)
  if (from === to) {
    query = query.eq('bill_month', from);
  } else {
    query = query.gte('bill_month', from).lt('bill_month', toExclusive);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, invoices: data ?? [] });
}
