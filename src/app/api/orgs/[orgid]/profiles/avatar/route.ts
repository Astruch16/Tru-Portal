import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, supabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type Params = { orgid?: string };

function uuidOf(s?: string | null) {
  if (!s) return null;
  const m = s.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  return m ? m[0].toLowerCase() : null;
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

    // Membership check
    const mem = await admin.from('org_memberships')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (mem.error) return NextResponse.json({ error: mem.error.message }, { status: 400 });
    if (!mem.data) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'file field required' }, { status: 400 });

    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const ab = await file.arrayBuffer();

    const up = await admin.storage.from('avatars').upload(path, ab, {
      contentType: file.type || 'image/png',
      upsert: true,
    });
    if (up.error) return NextResponse.json({ error: up.error.message }, { status: 400 });

    const pub = admin.storage.from('avatars').getPublicUrl(path);
    const publicUrl = pub.data.publicUrl;

    // Save on profile
    const upd = await admin.from('profiles')
      .upsert([{ id: user.id, avatar_url: publicUrl }], { onConflict: 'id' })
      .select('avatar_url')
      .maybeSingle();

    if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 });

    return NextResponse.json({ ok: true, avatar_url: publicUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
