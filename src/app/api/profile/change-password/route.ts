import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });

  const admin = createClient(url, key);

  // Get current user
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return NextResponse.json({ error: 'No authorization header' }, { status: 401 });

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await admin.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const newPassword = typeof body['new_password'] === 'string' ? body['new_password'] : '';

  if (!newPassword || newPassword.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  // Update password
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password: newPassword
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, message: 'Password updated successfully' });
}
