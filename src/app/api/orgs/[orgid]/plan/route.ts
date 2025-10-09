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

export async function GET(_req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const { orgid } = await ctx.params;            // 👈 await params
    const orgId = uuidOf(orgid);
    if (!orgId) return NextResponse.json({ error: 'Bad org id' }, { status: 400 });

    const admin = adminClient();

    // Prefer orgs table/view
    const org = await admin.from('orgs')
      .select('plan, fee_percent')
      .eq('id', orgId)
      .maybeSingle();

    if (org.error) return NextResponse.json({ error: org.error.message }, { status: 400 });
    if (org.data && org.data.plan) {
      return NextResponse.json({
        ok: true,
        plan: { tier: org.data.plan as Tier, percent: Number(org.data.fee_percent ?? TIER_MAP.launch) },
      });
    }

    // Fallback: latest invoice snapshot
    const inv = await admin.from('invoices')
      .select('plan_tier, fee_pct')
      .eq('org_id', orgId)
      .order('bill_month', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (inv.error) return NextResponse.json({ error: inv.error.message }, { status: 400 });
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
    const { orgid } = await ctx.params;            // 👈 await params
    const orgId = uuidOf(orgid);
    if (!orgId) return NextResponse.json({ error: 'Bad org id' }, { status: 400 });

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const tierRaw = typeof body['tier'] === 'string' ? body['tier'].toLowerCase() : '';
    const tiers = ['launch','elevate','maximize'] as const;
    const tier = (tiers as readonly string[]).includes(tierRaw) ? (tierRaw as Tier) : null;

    const override = body['percent'];
    const percent =
      typeof override === 'number'
        ? override
        : typeof override === 'string'
        ? Number(override)
        : tier
        ? TIER_MAP[tier]
        : NaN;

    if (!tier) return NextResponse.json({ error: 'tier must be launch|elevate|maximize' }, { status: 400 });
    if (!Number.isFinite(percent) || percent <= 0) {
      return NextResponse.json({ error: 'percent must be a positive number' }, { status: 400 });
    }

    const admin = adminClient();
    const upd = await admin.from('orgs')
      .update({ plan: tier, fee_percent: percent })
      .eq('id', orgId)
      .select('plan, fee_percent')
      .maybeSingle();

    if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 });

    return NextResponse.json({ ok: true, plan: { tier, percent: Number(upd.data?.fee_percent ?? percent) } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

