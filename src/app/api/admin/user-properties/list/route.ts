import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });

  const admin = createClient(url, key);

  // Get org_id from query params
  const orgId = req.nextUrl.searchParams.get('org_id');
  if (!orgId) return NextResponse.json({ error: 'org_id required' }, { status: 400 });

  // Get all user property assignments for this org
  const { data, error } = await admin
    .from('user_properties')
    .select(`
      id,
      user_id,
      property_id,
      airbnb_name,
      airbnb_url,
      profiles(full_name, username, email),
      properties(name)
    `)
    .eq('properties.org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Transform to simpler format
  const assignments = (data ?? []).map((a: any) => ({
    id: a.id,
    user_id: a.user_id,
    user_name: a.profiles?.full_name || a.profiles?.username || a.profiles?.email || 'Unknown',
    property_id: a.property_id,
    property_name: a.properties?.name || 'Unknown Property',
    airbnb_name: a.airbnb_name,
    airbnb_url: a.airbnb_url
  }));

  return NextResponse.json({ ok: true, assignments });
}
