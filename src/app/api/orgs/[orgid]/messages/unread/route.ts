import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// GET - Get count of unread messages
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgid?: string }> }
) {
  const { orgid: orgId } = await params;
  if (!orgId) return NextResponse.json({ error: 'Missing orgId' }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }

  const admin = createClient(url, key);

  // Get authenticated user from auth header
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await admin.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = user.id;

  try {
    // Count unread messages where user is the recipient
    const { count, error } = await admin
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('recipient_id', userId)
      .is('read_at', null);

    if (error) {
      console.error('Error counting unread messages:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, unreadCount: count || 0 });
  } catch (error) {
    console.error('Error in unread messages GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
