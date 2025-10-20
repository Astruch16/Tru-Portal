import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// GET - Fetch all conversations for admin
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

  const adminId = user.id;

  try {
    // Fetch all messages for this org where admin is sender or recipient
    const { data: messages, error: messagesError } = await admin
      .from('messages')
      .select('id, sender_id, recipient_id, message_text, created_at, read_at, property_id')
      .eq('org_id', orgId)
      .or(`sender_id.eq.${adminId},recipient_id.eq.${adminId}`)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return NextResponse.json({ error: messagesError.message }, { status: 400 });
    }

    console.log(`Conversations API - Admin: ${adminId}, Messages: ${messages?.length || 0}`);

    // Get all unique user IDs (excluding admin)
    const userIds = new Set<string>();
    messages?.forEach((m) => {
      if (m.sender_id !== adminId) userIds.add(m.sender_id);
      if (m.recipient_id !== adminId) userIds.add(m.recipient_id);
    });

    console.log('Conversations API - User IDs:', Array.from(userIds));

    // Fetch user profiles using service role (bypasses RLS)
    const { data: profiles, error: profilesError } = await admin
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', Array.from(userIds));

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return NextResponse.json({ error: profilesError.message }, { status: 400 });
    }

    console.log('Conversations API - Profiles fetched:', profiles?.length || 0);

    // Fetch property assignments for these users
    const { data: userPropertiesData, error: assignmentsError } = await admin
      .from('user_properties')
      .select('user_id, property_id')
      .in('user_id', Array.from(userIds));

    if (assignmentsError) {
      console.error('Error fetching property assignments:', assignmentsError);
    }

    console.log('Conversations API - Property assignments fetched:', userPropertiesData?.length || 0);

    // Get unique property IDs
    const propertyIds = Array.from(new Set(userPropertiesData?.map(up => up.property_id) || []));

    // Fetch property details
    const { data: propertiesData, error: propertiesError } = propertyIds.length > 0
      ? await admin
          .from('properties')
          .select('id, name')
          .in('id', propertyIds)
      : { data: [], error: null };

    if (propertiesError) {
      console.error('Error fetching properties:', propertiesError);
    }

    // Build a map of property ID to property info
    const propertyMap = new Map<string, { id: string; name: string }>();
    propertiesData?.forEach(prop => {
      propertyMap.set(prop.id, { id: prop.id, name: prop.name });
    });

    // Build a map of user properties
    const userPropertiesMap = new Map<string, Array<{ id: string; name: string }>>();
    userPropertiesData?.forEach(up => {
      if (!userPropertiesMap.has(up.user_id)) {
        userPropertiesMap.set(up.user_id, []);
      }
      const property = propertyMap.get(up.property_id);
      if (property) {
        userPropertiesMap.get(up.user_id)!.push(property);
      }
    });

    // Build conversations
    const conversations = profiles?.map(profile => {
      const userMessages = messages?.filter(
        m => m.sender_id === profile.id || m.recipient_id === profile.id
      ) || [];

      const sortedMessages = userMessages.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      const lastMessage = sortedMessages[sortedMessages.length - 1];
      const unreadCount = userMessages.filter(
        m => m.sender_id === profile.id && !m.read_at
      ).length;

      const userProperties = userPropertiesMap.get(profile.id) || [];

      return {
        userId: profile.id,
        userName: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown User',
        userEmail: profile.id, // Email not available in profiles table, using user ID as placeholder
        lastMessage: lastMessage?.message_text || '',
        lastMessageTime: lastMessage?.created_at || '',
        unreadCount,
        messages: sortedMessages,
        properties: userProperties
      };
    }) || [];

    // Sort by last message time
    conversations.sort((a, b) =>
      new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
    );

    return NextResponse.json({ ok: true, conversations });
  } catch (error) {
    console.error('Error in conversations GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
