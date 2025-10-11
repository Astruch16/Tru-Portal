import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';

function uuidOf(s?: string | null) {
  if (!s) return null;
  const m = s.match(/[0-9a-fA-F-]{36}/);
  return m ? m[0].toLowerCase() : null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgid?: string }> }
) {
  const { orgid } = await params;
  const orgId = uuidOf(orgid);
  if (!orgId) return NextResponse.json({ error: 'Bad org id' }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });

  const admin = createClient(url, key);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body !== 'object' || !body || !('name' in body)) {
    return NextResponse.json({ error: 'Missing property name' }, { status: 400 });
  }

  const name = (body as { name: unknown }).name;
  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Property name must be a non-empty string' }, { status: 400 });
  }

  // Create property
  const { data, error } = await admin
    .from('properties')
    .insert({ org_id: orgId, name: name.trim() })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, property: data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgid?: string }> }
) {
  const { orgid } = await params;
  const orgId = uuidOf(orgid);
  if (!orgId) return NextResponse.json({ error: 'Bad org id' }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });

  const admin = createClient(url, key);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body !== 'object' || !body || !('property_id' in body)) {
    return NextResponse.json({ error: 'Missing property_id' }, { status: 400 });
  }

  const propertyId = (body as { property_id: unknown }).property_id;
  if (typeof propertyId !== 'string') {
    return NextResponse.json({ error: 'property_id must be a string' }, { status: 400 });
  }

  // Delete property (CASCADE will handle related records)
  const { error } = await admin
    .from('properties')
    .delete()
    .eq('id', propertyId)
    .eq('org_id', orgId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, message: 'Property deleted' });
}
