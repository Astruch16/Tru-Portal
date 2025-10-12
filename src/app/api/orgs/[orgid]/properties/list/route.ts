import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';

function uuidOf(s?: string | null) {
  if (!s) return null;
  const m = s.match(/[0-9a-fA-F-]{36}/);
  return m ? m[0].toLowerCase() : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgid?: string }> }) {
  const { orgid } = await params;
  const orgId = uuidOf(orgid);
  if (!orgId) return NextResponse.json({ error: 'Bad org id' }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });

  const admin = createClient(url, key);

  // First, get all properties
  const { data: propertiesData, error: propertiesError } = await admin
    .from('properties')
    .select('id, name, address, property_type, airbnb_link')
    .eq('org_id', orgId)
    .order('name', { ascending: true });

  if (propertiesError) return NextResponse.json({ error: propertiesError.message }, { status: 400 });

  // Then, get all user_properties relationships
  const { data: userPropertiesData } = await admin
    .from('user_properties')
    .select(`
      property_id,
      users (
        id,
        first_name,
        last_name,
        email
      )
    `);

  // Create a map of property_id to user
  const propertyUserMap = new Map();
  if (userPropertiesData) {
    userPropertiesData.forEach((up: any) => {
      if (up.users) {
        propertyUserMap.set(up.property_id, up.users);
      }
    });
  }

  // Combine the data
  const properties = (propertiesData ?? []).map((prop: any) => {
    const user = propertyUserMap.get(prop.id);

    return {
      id: prop.id,
      name: prop.name,
      address: prop.address,
      property_type: prop.property_type,
      airbnb_link: prop.airbnb_link,
      assigned_user: user ? {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email
      } : null
    };
  });

  return NextResponse.json({ ok: true, properties });
}
