import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

type Tier = 'launch' | 'elevate' | 'maximize';
const TIER_MAP: Record<Tier, number> = { launch: 12, elevate: 18, maximize: 22 };

function uuidOf(s?: string | null) {
  if (!s) return null;
  const m = s.match(/[0-9a-fA-F-]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  return m ? m[0].toLowerCase() : null;
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env missing');
  return createClient(url, key);
}

type Params = { orgid?: string };

export async function GET(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const { orgid } = await ctx.params;
    const orgId = uuidOf(orgid);
    if (!orgId) return NextResponse.json({ error: 'Bad org id' }, { status: 400 });

    const admin = adminClient();

    // Get authenticated user
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data } = await admin.auth.getUser(token);
      userId = data.user?.id || null;
    }

    // If no bearer token, try to get user from cookies (SSR context)
    if (!userId) {
      // Try using supabaseServer for SSR
      try {
        const { supabaseServer } = await import('@/lib/supabase/server');
        const sb = await supabaseServer();
        const { data: { user } } = await sb.auth.getUser();
        userId = user?.id || null;
      } catch (e) {
        // Ignore cookie errors, userId will remain null
      }
    }

    // Get the most recent plan for this user and org
    let planQuery = admin.from('plans')
      .select('tier, percent')
      .eq('org_id', orgId);

    // If we have a userId, filter by it; otherwise get org-level plan (where user_id is null)
    if (userId) {
      planQuery = planQuery.eq('user_id', userId);
    } else {
      planQuery = planQuery.is('user_id', null);
    }

    const plan = await planQuery
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (plan.error && !/does not exist/i.test(plan.error.message)) {
      return NextResponse.json({ error: plan.error.message }, { status: 400 });
    }

    if (plan.data) {
      return NextResponse.json({
        ok: true,
        plan: { tier: plan.data.tier as Tier, percent: Number(plan.data.percent) },
      });
    }

    // Fallback: latest invoice snapshot
    const inv = await admin.from('invoices')
      .select('plan_tier, fee_pct')
      .eq('org_id', orgId)
      .order('bill_month', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (inv.error && !/does not exist/i.test(inv.error.message)) {
      return NextResponse.json({ error: inv.error.message }, { status: 400 });
    }

    if (inv.data) {
      const tier = (inv.data.plan_tier as Tier | null) ?? 'launch';
      const percent = Number(inv.data.fee_pct ?? TIER_MAP[tier]);
      return NextResponse.json({ ok: true, plan: { tier, percent } });
    }

    return NextResponse.json({ ok: true, plan: { tier: 'launch' as Tier, percent: 12 } });
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

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const tierRaw = typeof body['tier'] === 'string' ? body['tier'].toLowerCase() : '';
    const tiers = ['launch','elevate','maximize'] as const;
    const tier = (tiers as readonly string[]).includes(tierRaw) ? (tierRaw as Tier) : null;

    if (!tier) return NextResponse.json({ error: 'tier must be launch|elevate|maximize' }, { status: 400 });

    // Use the fixed percentage for the tier (enforced by DB constraint)
    const percent = TIER_MAP[tier];

    const admin = adminClient();

    // Insert a new plan record with today as effective_date
    // The UNIQUE constraint on (org_id, effective_date) prevents duplicates for the same day
    const ins = await admin.from('plans')
      .insert([{
        org_id: orgId,
        tier,
        percent,
        effective_date: new Date().toISOString().split('T')[0] // YYYY-MM-DD
      }])
      .select('tier, percent')
      .single();

    // If we get a unique violation, update the existing record for today
    if (ins.error && ins.error.message.includes('duplicate key')) {
      const upd = await admin.from('plans')
        .update({ tier, percent })
        .eq('org_id', orgId)
        .eq('effective_date', new Date().toISOString().split('T')[0])
        .select('tier, percent')
        .single();

      if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 });
      return NextResponse.json({ ok: true, plan: { tier: upd.data.tier as Tier, percent: Number(upd.data.percent) } });
    }

    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 400 });

    return NextResponse.json({ ok: true, plan: { tier: ins.data.tier as Tier, percent: Number(ins.data.percent) } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

