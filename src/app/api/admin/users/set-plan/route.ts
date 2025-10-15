import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, supabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function uuidOf(s?: string | null) {
  if (!s) return null;
  const m = s.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  return m ? m[0].toLowerCase() : null;
}

export async function POST(req: NextRequest) {
  console.log('=== Set Plan API Called ===');
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    console.log('Request body:', body);

    const userId = uuidOf(typeof body.user_id === 'string' ? body.user_id : null);
    const orgId = uuidOf(typeof body.org_id === 'string' ? body.org_id : null);
    const planTier = typeof body.plan_tier === 'string' ? body.plan_tier : '';

    console.log('Parsed values:', { userId, orgId, planTier });

    if (!userId) {
      console.log('Missing user_id');
      return NextResponse.json({ error: 'user_id required (UUID)' }, { status: 400 });
    }
    if (!orgId) {
      console.log('Missing org_id');
      return NextResponse.json({ error: 'org_id required (UUID)' }, { status: 400 });
    }
    if (!['launch', 'elevate', 'maximize'].includes(planTier)) {
      console.log('Invalid plan_tier:', planTier);
      return NextResponse.json({ error: 'plan_tier must be launch, elevate, or maximize' }, { status: 400 });
    }

    // Basic authentication check (role check removed since you're the only admin)
    const sb = await supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    console.log('Authenticated user:', user?.id);
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const admin = supabaseAdmin();

    // Map plan tier to percentage
    const percentMap: Record<string, number> = { launch: 12, elevate: 18, maximize: 22 };
    const percent = percentMap[planTier];

    // Check if user already has a plan for this org
    const { data: existingPlan, error: queryError } = await admin
      .from('plans')
      .select('id')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log('Query for existing plan:', { orgId, userId, existingPlan, queryError });

    if (existingPlan) {
      // Update existing plan
      const { error: updateError } = await admin
        .from('plans')
        .update({
          tier: planTier,
          percent: percent,
        })
        .eq('id', existingPlan.id);

      console.log('Update result:', { updateError });

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }

      // Recalculate all KPIs for this user with the new plan percentage
      const { data: kpis } = await admin
        .from('kpis')
        .select('id, gross_revenue_cents, expenses_cents')
        .eq('org_id', orgId)
        .eq('user_id', userId);

      if (kpis && kpis.length > 0) {
        for (const kpi of kpis) {
          const truHostFees = Math.floor((kpi.gross_revenue_cents * percent) / 100);
          const newNetRevenue = kpi.gross_revenue_cents - kpi.expenses_cents - truHostFees;

          await admin
            .from('kpis')
            .update({
              net_revenue_cents: newNetRevenue,
              updated_at: new Date().toISOString()
            })
            .eq('id', kpi.id);
        }
        console.log(`Recalculated ${kpis.length} KPI records for user`);
      }

      return NextResponse.json({ ok: true, message: 'Plan updated successfully', action: 'updated' });
    } else {
      // Create new plan
      const planData = {
        org_id: orgId,
        user_id: userId,
        tier: planTier,
        percent: percent,
        effective_date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD
      };

      console.log('Creating new plan:', planData);

      const { error: insertError, data: newPlan } = await admin
        .from('plans')
        .insert([planData])
        .select()
        .single();

      console.log('Insert result:', { insertError, newPlan });

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 400 });
      }

      return NextResponse.json({ ok: true, message: 'Plan created successfully', action: 'created', plan: newPlan });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
