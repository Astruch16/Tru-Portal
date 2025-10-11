import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, supabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type Params = { orgid?: string };

function uuidOf(s?: string | null) {
  if (!s) return null;
  const m = s.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  return m ? m[0].toLowerCase() : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const { orgid } = await params;
    const orgId = uuidOf(orgid);
    if (!orgId) return NextResponse.json({ error: 'Bad org id' }, { status: 400 });

    // Check authentication
    const sb = await supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const admin = supabaseAdmin();

    // For development: Allow any authenticated user to view org users
    // In production, you should add proper role-based authorization here

    // Get org members (user_id and role)
    const { data: memberships, error: membershipsError } = await admin
      .from('org_memberships')
      .select('user_id, role')
      .eq('org_id', orgId);

    if (membershipsError) return NextResponse.json({ error: membershipsError.message }, { status: 400 });

    // Get auth users for emails
    const userIds = (memberships ?? []).map((m: any) => m.user_id);
    const authUsers = userIds.length > 0
      ? await Promise.all(userIds.map(id => admin.auth.admin.getUserById(id)))
      : [];

    // Get profiles for names and avatars
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, first_name, last_name, avatar_url')
      .in('id', userIds);

    // Combine data
    const users = (memberships ?? []).map((m: any) => {
      const authUser = authUsers.find(u => u.data?.user?.id === m.user_id)?.data?.user;
      const profile = (profiles ?? []).find((p: any) => p.id === m.user_id);

      return {
        id: m.user_id,
        email: authUser?.email ?? '',
        full_name: profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : '',
        username: profile?.first_name ?? '',
        avatar_url: profile?.avatar_url ?? null,
        role: m.role,
      };
    });

    return NextResponse.json({ ok: true, users });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
