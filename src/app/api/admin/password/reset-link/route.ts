import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, supabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function originFrom(req: NextRequest) {
  const h = req.headers;
  return (
    h.get('origin') ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000'
  );
}

// Safely read a string property from an unknown object (no `any`)
function readStringProp(obj: unknown, key: string): string | undefined {
  if (typeof obj !== 'object' || obj === null) return undefined;
  const rec = obj as Record<string, unknown>;
  const v = rec[key];
  return typeof v === 'string' ? v : undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      org_id?: string;
    };
    const email = (body.email || '').trim();
    const orgId = (body.org_id || '').trim();

    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });
    if (!orgId) return NextResponse.json({ error: 'org_id required' }, { status: 400 });

    // Require caller to be authenticated owner/manager of the org
    const sb = await supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const admin = supabaseAdmin();

    // verify caller's role in this org
    const mem = await admin
      .from('org_memberships')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (mem.error) return NextResponse.json({ error: mem.error.message }, { status: 400 });
    if (!mem.data || !['owner', 'manager'].includes(String(mem.data.role))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // generate a recovery (password reset) link
    const redirectTo = `${originFrom(req)}/reset`;
    const gl = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    });

    if (gl.error) return NextResponse.json({ error: gl.error.message }, { status: 400 });

    // Supabase returns { data: { properties, user } }
    const props = gl.data?.properties as unknown;

    // Handle both possible property names without using `any`
    const link =
      readStringProp(props, 'action_link') ??
      readStringProp(props, 'actionLink');

    return NextResponse.json({
      ok: true,
      link,              // may be undefined on some setups; see properties below
      properties: props, // diagnostic context (otp, hashed_token, etc.)
      user: gl.data?.user ? { id: gl.data.user.id, email: gl.data.user.email } : null,
      redirectTo,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Optional GET so visiting the URL in a browser shows usage instead of 404
export async function GET() {
  return NextResponse.json({
    ok: true,
    usage: 'POST JSON { email, org_id } to get a password reset link for that email',
    example: {
      email: 'member@example.com',
      org_id: '9f2d435f-e0be-4995-addc-3524527e637b'
    }
  });
}

