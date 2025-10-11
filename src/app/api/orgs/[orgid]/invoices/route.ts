import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, supabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function uuidOf(s?: string | null) {
  if (!s) return null;
  const m = s.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  return m ? m[0].toLowerCase() : null;
}
function monthStart(m?: string | null): Date | null {
  if (!m) return null;
  const mm = m.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (!mm) return null;
  return new Date(Date.UTC(Number(mm[1]), Number(mm[2]) - 1, 1));
}
function nextMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
type Row = { [k: string]: Json };

function readString(row: Row, key: string): string | undefined {
  const v = row[key];
  return typeof v === 'string' ? v : undefined;
}

// GET /api/orgs/[orgid]/invoices?month=YYYY-MM (optional)
export async function GET(req: NextRequest, { params }: { params: { orgid?: string } }) {
  try {
    const orgId = uuidOf(params?.orgid);
    if (!orgId) return NextResponse.json({ error: 'Bad org id' }, { status: 400 });

    const url = new URL(req.url);
    const monthParam = url.searchParams.get('month'); // YYYY-MM optional
    const start = monthStart(monthParam);
    const end = start ? nextMonth(start) : null;

    // must be logged in & member of org
    const sb = await supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const admin = supabaseAdmin();
    const mem = await admin
      .from('org_memberships')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (mem.error) return NextResponse.json({ error: mem.error.message }, { status: 400 });
    if (!mem.data) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Only select columns we know exist in your schema (no total_cents, no file_path)
    let q = admin
      .from('invoices')
      .select('id, org_id, created_at, status, currency')
      .eq('org_id', orgId);

    if (start && end) {
      q = q
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString())
        .order('created_at', { ascending: false });
    } else {
      q = q.order('created_at', { ascending: false }).limit(12);
    }

    const inv = await q;
    if (inv.error) return NextResponse.json({ error: inv.error.message }, { status: 400 });

    const items = (inv.data as unknown as Row[]).map((r) => {
      const created = readString(r, 'created_at') ?? new Date().toISOString();
      const d = new Date(created);
      const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      return {
        id: readString(r, 'id'),
        org_id: readString(r, 'org_id'),
        created_at: created,
        month,
        status: readString(r, 'status') ?? 'due',
        currency: readString(r, 'currency') ?? 'CAD',
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


