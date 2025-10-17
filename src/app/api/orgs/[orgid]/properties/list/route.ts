import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';

function uuidOf(s?: string | null) {
  if (!s) return null;
  const m = s.match(/[0-9a-fA-F-]{36}/);
  return m ? m[0].toLowerCase() : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgid?: string }> }) {
  const { orgid } = await params;
  const orgId = uuidOf(orgid);
  if (!orgId) return NextResponse.json({ error: 'Bad org id' }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });

  const admin = createClient(url, key);

  // Check if this request is from a member portal (has auth header)
  const authHeader = req.headers.get('authorization');
  let userPropertyIds: string[] = [];

  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await admin.auth.getUser(token);

    if (user) {
      // Get properties assigned to this user
      const { data: userProperties } = await admin
        .from('user_properties')
        .select('property_id')
        .eq('user_id', user.id);

      if (userProperties && userProperties.length > 0) {
        userPropertyIds = userProperties.map(up => up.property_id);
      } else {
        // User has no assigned properties, return empty array immediately
        return NextResponse.json({ ok: true, properties: [] });
      }
    }
  }

  // Get properties - filter by user's assigned properties if authenticated member
  let propertiesQuery = admin
    .from('properties')
    .select('id, name, address, property_type, airbnb_link')
    .eq('org_id', orgId);

  // If user has specific properties, filter to only those
  if (userPropertyIds.length > 0) {
    propertiesQuery = propertiesQuery.in('id', userPropertyIds);
  }

  const { data: propertiesData, error: propertiesError } = await propertiesQuery.order('name', { ascending: true });

  if (propertiesError) return NextResponse.json({ error: propertiesError.message }, { status: 400 });

  // Then, get all user_properties relationships
  const { data: userPropertiesData, error: upError } = await admin
    .from('user_properties')
    .select('property_id, user_id');

  console.log('User properties data:', userPropertiesData, 'Error:', upError);

  // Get user IDs
  const userIds = (userPropertiesData ?? []).map((up: any) => up.user_id);

  // Get profiles for those users
  const { data: profilesData } = userIds.length > 0
    ? await admin
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', userIds)
    : { data: [] };

  console.log('Profiles data:', profilesData);

  // Create a map of user_id to profile
  const userProfileMap = new Map();
  if (profilesData) {
    profilesData.forEach((profile: any) => {
      userProfileMap.set(profile.id, profile);
    });
  }

  // Create a map of property_id to user
  const propertyUserMap = new Map();
  if (userPropertiesData) {
    userPropertiesData.forEach((up: any) => {
      const profile = userProfileMap.get(up.user_id);
      if (profile) {
        propertyUserMap.set(up.property_id, {
          id: up.user_id,
          first_name: profile.first_name,
          last_name: profile.last_name,
        });
      }
    });
  }

  console.log('Property user map:', propertyUserMap);

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
        last_name: user.last_name
      } : null
    };
  });

  return NextResponse.json({ ok: true, properties });
}
