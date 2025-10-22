import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

  try {
    // Get all reviews for the org with property information
    const { data: reviews, error } = await admin
      .from('reviews')
      .select(`
        *,
        properties (
          id,
          name
        )
      `)
      .eq('org_id', orgId)
      .order('review_date', { ascending: false });

    if (error) {
      console.error('Error fetching reviews:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, reviews: reviews || [] });
  } catch (error) {
    console.error('Error in reviews GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
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

  // Verify user is admin (owner or manager)
  const { data: membership } = await admin
    .from('org_memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .single();

  if (!membership || (membership.role !== 'owner' && membership.role !== 'manager')) {
    return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { property_id, platform, rating, review_text, review_date } = body;

    // Validate required fields
    if (!property_id || !platform || rating === undefined || !review_date) {
      return NextResponse.json(
        { error: 'Missing required fields: property_id, platform, rating, review_date' },
        { status: 400 }
      );
    }

    // Validate platform
    if (platform !== 'airbnb' && platform !== 'vrbo') {
      return NextResponse.json(
        { error: 'Platform must be either "airbnb" or "vrbo"' },
        { status: 400 }
      );
    }

    // Validate rating based on platform
    if (platform === 'airbnb' && (rating < 0 || rating > 5)) {
      return NextResponse.json(
        { error: 'Airbnb rating must be between 0 and 5' },
        { status: 400 }
      );
    }

    if (platform === 'vrbo' && (rating < 0 || rating > 10)) {
      return NextResponse.json(
        { error: 'VRBO rating must be between 0 and 10' },
        { status: 400 }
      );
    }

    // Insert review
    const { data: review, error } = await admin
      .from('reviews')
      .insert({
        org_id: orgId,
        property_id,
        platform,
        rating,
        review_text: review_text || null,
        review_date,
      })
      .select(`
        *,
        properties (
          id,
          name
        )
      `)
      .single();

    if (error) {
      console.error('Error creating review:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, review });
  } catch (error) {
    console.error('Error in reviews POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
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

  // Verify user is admin (owner or manager)
  const { data: membership } = await admin
    .from('org_memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .single();

  if (!membership || (membership.role !== 'owner' && membership.role !== 'manager')) {
    return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const reviewId = searchParams.get('id');

    if (!reviewId) {
      return NextResponse.json({ error: 'Missing review ID' }, { status: 400 });
    }

    // Delete the review
    const { error } = await admin
      .from('reviews')
      .delete()
      .eq('id', reviewId)
      .eq('org_id', orgId); // Ensure review belongs to this org

    if (error) {
      console.error('Error deleting review:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error in reviews DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
