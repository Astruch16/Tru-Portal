import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, supabaseServer } from '@/lib/supabase/server';

type Role = 'owner' | 'manager' | 'member';

function uuidOf(s?: string | null) {
  if (!s) return null;
  const m = s.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  return m ? m[0].toLowerCase() : null;
}

export const runtime = 'nodejs';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const orgId = uuidOf(typeof body.org_id === 'string' ? body.org_id : null);
    const roleVal = (typeof body.role === 'string' ? body.role.toLowerCase() : 'member') as Role;
    const firstName = typeof body.first_name === 'string' ? body.first_name.trim() : '';
    const lastName = typeof body.last_name === 'string' ? body.last_name.trim() : '';
    const planTier = typeof body.plan_tier === 'string' ? body.plan_tier : null;

    if (!email || !password) return NextResponse.json({ error: 'email and password required' }, { status: 400 });
    if (!orgId) return NextResponse.json({ error: 'org_id required (UUID)' }, { status: 400 });
    if (!['owner','manager','member'].includes(roleVal)) {
      return NextResponse.json({ error: 'role must be owner|manager|member' }, { status: 400 });
    }

    // 0) Authz: only owner/manager can invite into this org
    const sb = await supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const admin = supabaseAdmin();

    // Ensure org exists
    const org = await admin.from('orgs').select('id').eq('id', orgId).maybeSingle();
    if (org.error) return NextResponse.json({ error: org.error.message }, { status: 400 });
    if (!org.data) return NextResponse.json({ error: 'org not found' }, { status: 400 });

    // Check caller’s role in this org
    const mem = await admin
      .from('org_memberships')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (mem.error) return NextResponse.json({ error: mem.error.message }, { status: 400 });
    if (!mem.data || !['owner','manager'].includes((mem.data.role as Role))) {
      return NextResponse.json({ error: 'Forbidden: owner or manager required' }, { status: 403 });
    }

    // 1) Create the auth user (confirmed)
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) return NextResponse.json({ error: created.error.message }, { status: 400 });

    const userId = created.data.user?.id;
    if (!userId) return NextResponse.json({ error: 'No user id returned from createUser' }, { status: 500 });

    // 2) Verify user visible (eventual consistency guard)
    {
      let ok = false;
      for (let i = 0; i < 4; i++) {
        const check = await admin.auth.admin.getUserById(userId);
        if (check.data?.user?.id === userId) { ok = true; break; }
        await sleep(150);
      }
      if (!ok) return NextResponse.json({ error: 'Auth user not visible yet; retry shortly', user_id: userId }, { status: 500 });
    }

    // 3) Create/update profile with first_name and last_name
    try {
      const profileData: any = { id: userId };
      if (firstName) profileData.first_name = firstName;
      if (lastName) profileData.last_name = lastName;

      const prof = await admin.from('profiles').upsert([profileData], { onConflict: 'id' });
      if (prof.error && !/relation .*profiles.* does not exist/i.test(prof.error.message)) {
        // Non-fatal if your FK targets auth.users instead
      }
    } catch { /* ignore if profiles table not present */ }

    // 4) Link to org
    const link = await admin
      .from('org_memberships')
      .insert([{ org_id: orgId, user_id: userId, role: roleVal }])
      .select('org_id, user_id, role')
      .single();

    if (link.error) {
      const code = (link.error as { code?: string } | undefined)?.code ?? '';
      if (code === '23503') {
        return NextResponse.json({
          error: 'FK violation inserting into org_memberships',
          hint: 'Ensure org exists and user_id exists in the referenced table.',
          details: { org_id: orgId, user_id: userId },
        }, { status: 400 });
      }
      return NextResponse.json({ error: link.error.message }, { status: 400 });
    }

    // 5) Create plan if plan_tier is provided
    if (planTier && ['launch', 'elevate', 'maximize'].includes(planTier)) {
      const percentMap: Record<string, number> = { launch: 12, elevate: 18, maximize: 22 };
      const percent = percentMap[planTier];

      const planData = {
        org_id: orgId,
        user_id: userId,
        tier: planTier,
        percent: percent,
        effective_date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD
      };

      const planResult = await admin
        .from('plans')
        .insert([planData])
        .select()
        .single();

      if (planResult.error) {
        // Log error but don't fail the whole operation
        console.error('Failed to create plan:', planResult.error);
      }
    }

    return NextResponse.json({ ok: true, user: { id: userId, email }, membership: link.data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
