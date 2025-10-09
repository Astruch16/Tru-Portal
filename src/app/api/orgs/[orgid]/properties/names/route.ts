import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, supabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type Params = { orgid?: string };
function uuidOf(s?: string | null) {
  if (!s) return null;
  const m = s.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  return m ? m[0].toLowerCase() : null;
}

type NameUpdate = { id: string; airbnb_name: string };

export async function POST(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const { orgid } = await ctx.params;
    const orgId = uuidOf(orgid);
    if (!orgId) return NextResponse.json({ error: 'Bad org id' }, { status: 400 });

    const sb = await supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const admin = supabaseAdmin();

    // Require owner/manager
    const mem = await admin.from('org_memberships')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (mem.error) return NextResponse.json({ error: mem.error.message }, { status: 400 });
    if (!mem.data || !['owner','manager'].includes(String(mem.data.role))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const list = Array.isArray(body['updates']) ? (body['updates'] as unknown[]) : [];
    const updates: NameUpdate[] = list
      .map((x) => (typeof x === 'object' && x !== null ? x as Record<string, unknown> : {}))
      .map((r) => {
        const id = typeof r['id'] === 'string' ? r['id'] : '';
        const airbnb_name = typeof r['airbnb_name'] === 'string' ? r['airbnb_name'] : '';
        return { id, airbnb_name };
      })
      .filter((u) => u.id && u.airbnb_name);

    if (updates.length === 0) return NextResponse.json({ error: 'No updates provided' }, { status: 400 });

    // Update each (keeps per-id names)
    for (const u of updates) {
      const upd = await admin.from('properties')
        .update({ airbnb_name: u.airbnb_name })
        .eq('id', u.id)
        .eq('org_id', orgId);
      if (upd.error) {
        return NextResponse.json({ error: `Property ${u.id}: ${upd.error.message}` }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true, count: updates.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
