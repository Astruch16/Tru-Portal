import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, property_id, airbnb_name, airbnb_url } = body;

    if (!user_id || !property_id) {
      return NextResponse.json(
        { error: 'user_id and property_id are required' },
        { status: 400 }
      );
    }

    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supaUrl, serviceKey);

    // Assign property to user
    const { data, error } = await supabase
      .from('user_properties')
      .upsert({
        user_id,
        property_id,
        airbnb_name: airbnb_name || null,
        airbnb_url: airbnb_url || null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ assignment: data });
  } catch (error) {
    console.error('Property assignment error:', error);
    return NextResponse.json({ error: 'Assignment failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Assignment ID required' }, { status: 400 });
    }

    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supaUrl, serviceKey);

    const { error } = await supabase
      .from('user_properties')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete assignment error:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
