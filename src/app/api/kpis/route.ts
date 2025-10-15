// src/app/api/kpis/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';

function extractUUID(s: string | null) {
  if (!s) return null;
  const m = s.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  return m ? m[0].toLowerCase() : null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const orgId = extractUUID(url.searchParams.get('org'));
  const month = (url.searchParams.get('month') ?? new Date().toISOString().slice(0,7)) + '-01';
  if (!orgId) return NextResponse.json({ error: 'Missing or bad ?org=UUID' }, { status: 400 });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Get the authenticated user from the Authorization header
  const authHeader = req.headers.get('Authorization');
  let userId: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const { data: { user } } = await admin.auth.getUser(token);
      userId = user?.id || null;
    } catch (err) {
      console.error('Error getting user from token:', err);
    }
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized - user not found' }, { status: 401 });
  }

  // Fetch user-specific KPIs for this org and month
  const { data, error } = await admin
    .from('kpis')
    .select('*')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .eq('month', month);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, kpis: data || [] });
}
