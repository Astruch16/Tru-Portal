import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// GET - Fetch messages for a conversation
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

  // Get optional query params for filtering
  const searchParams = req.nextUrl.searchParams;
  const otherUserId = searchParams.get('userId'); // Get conversation with specific user

  try {
    let query = admin
      .from('messages')
      .select(`
        id,
        sender_id,
        recipient_id,
        message_text,
        created_at,
        read_at,
        property_id
      `)
      .eq('org_id', orgId)
      .order('created_at', { ascending: true });

    if (otherUserId) {
      // Get conversation between current user and specific other user
      query = query.or(
        `and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`
      );
    } else {
      // Get all messages where user is sender or recipient
      query = query.or(`sender_id.eq.${userId},recipient_id.eq.${userId}`);
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.log(`Messages GET - User: ${userId}, Found ${messages?.length || 0} messages`);
    if (messages && messages.length > 0) {
      console.log('First message:', messages[0]);
    }

    return NextResponse.json({ ok: true, messages: messages || [] });
  } catch (error) {
    console.error('Error in messages GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Send a new message
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

  const userId = user.id;

  // Parse request body
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { recipientId, messageText, propertyId } = body;

  if (!recipientId || !messageText || typeof messageText !== 'string' || messageText.trim() === '') {
    return NextResponse.json({ error: 'recipientId and messageText are required' }, { status: 400 });
  }

  try {
    const { data: message, error } = await admin
      .from('messages')
      .insert({
        org_id: orgId,
        sender_id: userId,
        recipient_id: recipientId,
        message_text: messageText.trim(),
        property_id: propertyId || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error sending message:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, message });
  } catch (error) {
    console.error('Error in messages POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Mark messages as read
export async function PATCH(
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

  // Parse request body
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { messageIds } = body;

  if (!messageIds || !Array.isArray(messageIds)) {
    return NextResponse.json({ error: 'messageIds array is required' }, { status: 400 });
  }

  try {
    const { error } = await admin
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('org_id', orgId)
      .eq('recipient_id', userId)
      .in('id', messageIds)
      .is('read_at', null); // Only update unread messages

    if (error) {
      console.error('Error marking messages as read:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error in messages PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
