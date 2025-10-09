import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, supabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type Params = { orgid?: string };

function uuidOf(s?: string | null) {
  if (!s) return null;
  const m = s.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  return m ? m[0].toLowerCase() : null;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const { orgid } = await ctx.params;
    const orgId = uuidOf(orgid);
    if (!orgId) return NextResponse.json({ error: 'Bad org id' }, { status: 400 });

    const sb = await supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const admin = supabaseAdmin();

    // Check membership
    const mem = await admin.from('org_memberships')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (mem.error) return NextResponse.json({ error: mem.error.message }, { status: 400 });
    if (!mem.data) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Profile
    const prof = await admin.from('profiles')
      .select('first_name,last_name,avatar_url')
      .eq('id', user.id)
      .maybeSingle();
    if (prof.error) return NextResponse.json({ error: prof.error.message }, { status: 400 });

    // Plan
    const plan = await admin.from('orgs')
      .select('plan, fee_percent')
      .eq('id', orgId)
      .maybeSingle();

    // Properties (Airbnb names)
    const props = await admin.from('properties')
      .select('id, airbnb_name')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true });

    return NextResponse.json({
      ok: true,
      profile: {
        first_name: prof.data?.first_name ?? '',
        last_name:  prof.data?.last_name ?? '',
        avatar_url: prof.data?.avatar_url ?? '',
      },
      plan: plan.data ? { tier: plan.data.plan, percent: Number(plan.data.fee_percent ?? 0) } : null,
      properties: props.data ?? [],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const { orgid } = await ctx.params;
    const orgId = uuidOf(orgid);
    if (!orgId) return NextResponse.json({ error: 'Bad org id' }, { status: 400 });

    const sb = await supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const admin = supabaseAdmin();

    // Must be at least a member
    const mem = await admin.from('org_memberships')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (mem.error) return NextResponse.json({ error: mem.error.message }, { status: 400 });
    if (!mem.data) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const first_name = typeof body['first_name'] === 'string' ? body['first_name'] : undefined;
    const last_name  = typeof body['last_name']  === 'string' ? body['last_name']  : undefined;

    if (first_name === undefined && last_name === undefined) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const upd = await admin.from('profiles')
      .upsert([{ id: user.id, first_name, last_name }], { onConflict: 'id', ignoreDuplicates: false })
      .select('first_name,last_name')
      .maybeSingle();

    if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 });

    return NextResponse.json({ ok: true, profile: upd.data ?? { first_name, last_name } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
