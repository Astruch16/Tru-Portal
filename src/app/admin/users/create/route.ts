import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

type Role = 'owner' | 'manager' | 'member';

function uuidOf(s?: string | null) {
  if (!s) return null;
  const m = s.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  return m ? m[0].toLowerCase() : null;
}

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const orgId = uuidOf(typeof body.org_id === 'string' ? body.org_id : null);
    const roleVal = typeof body.role === 'string' ? (body.role.toLowerCase() as Role) : 'member';

    if (!email || !password) return NextResponse.json({ error: 'email and password required' }, { status: 400 });
    if (!orgId) return NextResponse.json({ error: 'org_id required (UUID)' }, { status: 400 });
    if (!['owner','manager','member'].includes(roleVal)) {
      return NextResponse.json({ error: 'role must be owner|manager|member' }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // 1) Create the auth user (email confirmed so they can log in immediately)
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (created.error) {
      return NextResponse.json({ error: created.error.message }, { status: 400 });
    }

    const userId = created.data.user?.id;
    if (!userId) return NextResponse.json({ error: 'No user id returned' }, { status: 500 });

    // 2) Link to org (service role bypasses RLS)
    const link = await admin
      .from('org_memberships')
      .insert([{ org_id: orgId, user_id: userId, role: roleVal }])
      .select('org_id, user_id, role')
      .single();

    if (link.error) {
      return NextResponse.json({ error: link.error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      user: { id: userId, email },
      membership: link.data,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
