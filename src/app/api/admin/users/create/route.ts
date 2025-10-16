import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, supabaseServer } from '@/lib/supabase/server';
import { sendMemberInvitationEmail } from '@/lib/email';

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

    // Check caller's role in this org
    const mem = await admin
      .from('org_memberships')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .maybeSingle();

    console.log('Authorization check:', {
      userId: user.id,
      orgId,
      membershipData: mem.data,
      membershipError: mem.error,
    });

    if (mem.error) return NextResponse.json({ error: mem.error.message }, { status: 400 });
    if (!mem.data || !['owner','manager'].includes((mem.data.role as Role))) {
      return NextResponse.json({
        error: 'Forbidden: owner or manager required',
        debug: {
          foundMembership: !!mem.data,
          role: mem.data?.role,
          userId: user.id,
          orgId: orgId
        }
      }, { status: 403 });
    }

    // 1) Check if user already exists in auth, if so use existing, otherwise create new
    let userId: string;
    let userExists = false;

    // Try to find existing user by email
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    const existingUser = existingUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (existingUser) {
      // User already exists in auth, use their ID and update password
      userId = existingUser.id;
      userExists = true;

      // Update the user's password
      const updateResult = await admin.auth.admin.updateUserById(userId, {
        password: password,
        email_confirm: true,
      });

      if (updateResult.error) {
        console.error('Failed to update existing user password:', updateResult.error);
      }

      console.log('✓ Re-inviting existing auth user:', email);
    } else {
      // Create new auth user
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error) return NextResponse.json({ error: created.error.message }, { status: 400 });

      userId = created.data.user?.id;
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

    // 4) Link to org (or update if already exists)
    // Check if membership already exists
    const { data: existingMembership } = await admin
      .from('org_memberships')
      .select('*')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();

    let link;
    if (existingMembership) {
      // Update existing membership
      link = await admin
        .from('org_memberships')
        .update({ role: roleVal })
        .eq('org_id', orgId)
        .eq('user_id', userId)
        .select('org_id, user_id, role')
        .single();

      console.log('✓ Updated existing org membership for user:', email);
    } else {
      // Create new membership
      link = await admin
        .from('org_memberships')
        .insert([{ org_id: orgId, user_id: userId, role: roleVal }])
        .select('org_id, user_id, role')
        .single();
    }

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

    // 5) Create or update plan if plan_tier is provided
    if (planTier && ['launch', 'elevate', 'maximize'].includes(planTier)) {
      const percentMap: Record<string, number> = { launch: 12, elevate: 18, maximize: 22 };
      const percent = percentMap[planTier];

      // Check if plan already exists
      const { data: existingPlan } = await admin
        .from('plans')
        .select('*')
        .eq('org_id', orgId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingPlan) {
        // Update existing plan
        const planResult = await admin
          .from('plans')
          .update({
            tier: planTier,
            percent: percent,
            effective_date: new Date().toISOString().split('T')[0],
          })
          .eq('org_id', orgId)
          .eq('user_id', userId)
          .select()
          .single();

        if (planResult.error) {
          console.error('Failed to update plan:', planResult.error);
        } else {
          console.log('✓ Updated existing plan for user:', email);
        }
      } else {
        // Create new plan
        const planData = {
          org_id: orgId,
          user_id: userId,
          tier: planTier,
          percent: percent,
          effective_date: new Date().toISOString().split('T')[0],
        };

        const planResult = await admin
          .from('plans')
          .insert([planData])
          .select()
          .single();

        if (planResult.error) {
          console.error('Failed to create plan:', planResult.error);
        }
      }
    }

    // 6) Send welcome email notification
    try {
      // Get org name
      const { data: orgData } = await admin.from('orgs').select('name').eq('id', orgId).maybeSingle();
      const orgName = orgData?.name || 'Your Organization';

      // Get inviter name
      const { data: inviterProfile } = await admin.from('profiles').select('first_name, last_name').eq('id', user.id).maybeSingle();
      const inviterName = inviterProfile
        ? `${inviterProfile.first_name || ''} ${inviterProfile.last_name || ''}`.trim() || user.email || 'Your admin'
        : user.email || 'Your admin';

      const recipientName = `${firstName} ${lastName}`.trim() || email.split('@')[0];

      await sendMemberInvitationEmail({
        recipientEmail: email,
        recipientName,
        organizationName: orgName,
        inviterName,
        orgId,
        email: email,
        temporaryPassword: password,
        planTier: planTier || undefined,
      });
    } catch (emailError) {
      // Log error but don't fail the user creation
      console.error('Failed to send welcome email:', emailError);
    }

    return NextResponse.json({ ok: true, user: { id: userId, email }, membership: link.data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
