'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';

type Reaction = {
  emoji: string;
  user_id: string;
  created_at: string;
};

type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  message_text: string;
  created_at: string;
  read_at: string | null;
  property_id: string | null;
  reactions?: Reaction[];
};

type Property = {
  id: string;
  name: string;
};

// Helper function to format date groups
function getDateLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const messageDate = new Date(date);
  messageDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  yesterday.setHours(0, 0, 0, 0);

  if (messageDate.getTime() === today.getTime()) {
    return 'Today';
  } else if (messageDate.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  } else {
    return messageDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: messageDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  }
}

// Helper function to group messages by date
function groupMessagesByDate(messages: Message[]): Array<{ date: string; messages: Message[] }> {
  const groups = new Map<string, Message[]>();

  messages.forEach(message => {
    const dateLabel = getDateLabel(new Date(message.created_at));
    if (!groups.has(dateLabel)) {
      groups.set(dateLabel, []);
    }
    groups.get(dateLabel)!.push(message);
  });

  return Array.from(groups.entries()).map(([date, messages]) => ({
    date,
    messages
  }));
}

export default function MemberMessagesPage({ params }: { params: Promise<{ orgid: string }> }) {
  const [orgId, setOrgId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draftMessages, setDraftMessages] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const sb = supabaseClient();

  useEffect(() => {
    params.then(p => setOrgId(p.orgid));
  }, [params]);

  useEffect(() => {
    if (!orgId) return;

    const init = async () => {
      // Get current user
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setCurrentUserId(user.id);

      // Get session for API calls
      const { data: { session } } = await sb.auth.getSession();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      // Get admin user ID (org owner) via API
      const usersResponse = await fetch(`/api/orgs/${orgId}/users`, { headers });
      const usersData = await usersResponse.json();

      console.log('Member portal - Current user ID:', user.id);
      console.log('Member portal - Users API status:', usersResponse.status);
      console.log('Member portal - Users API response:', usersData);
      console.log('Member portal - Users list:', usersData.users);

      if (usersData.ok && usersData.users) {
        // Log all user roles for debugging
        usersData.users.forEach((u: any) => {
          console.log(`Member portal - User: ${u.id} (${u.first_name} ${u.last_name}) - Role: "${u.role}"`);
        });

        // Look for owner, admin, or manager role
        const owner = usersData.users.find((u: any) =>
          u.role === 'owner' || u.role === 'admin' || u.role === 'manager'
        );
        console.log('Member portal - Found owner/admin/manager:', owner);

        // If no owner/admin/manager found, try to find any user that's NOT the current user
        // This handles legacy setups where roles might not be properly set
        const fallbackAdmin = !owner
          ? usersData.users.find((u: any) => u.id !== user.id)
          : null;

        if (fallbackAdmin) {
          console.log('Member portal - Using fallback admin (no owner role found):', fallbackAdmin);
        }

        const adminUser = owner || fallbackAdmin;

        if (adminUser && adminUser.id !== user.id) {
          // Only set adminId if the current user is NOT the owner/admin
          console.log('Member portal - Setting adminId to:', adminUser.id);
          setAdminId(adminUser.id);
        } else if (adminUser && adminUser.id === user.id) {
          // Current user IS the owner/admin - they should use admin portal for messaging
          setIsOwner(true);
          console.log('Member portal - Current user is the owner/admin, cannot message self');
        } else {
          console.log('Member portal - No other users found in org to message!');
        }
      } else {
        console.log('Member portal - Users API failed or returned no users:', usersData);
      }

      // Fetch properties assigned to this user using the API
      if (session) {
        const response = await fetch(`/api/orgs/${orgId}/properties/list`, { headers });
        const data = await response.json();

        if (data.ok && data.properties) {
          const simpleProperties = data.properties.map((p: any) => ({
            id: p.id,
            name: p.name
          }));
          setProperties(simpleProperties);
        }
      }

      // Fetch messages
      await fetchMessages(user.id);
      setLoading(false);
    };

    init();
  }, [orgId, sb, router]);

  const fetchMessages = async (userId: string) => {
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) {
        console.log('No session found when fetching messages');
        return;
      }

      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      console.log('Fetching messages from:', `/api/orgs/${orgId}/messages`);
      const response = await fetch(`/api/orgs/${orgId}/messages`, { headers });
      const data = await response.json();
      console.log('Messages response:', data);

      if (data.ok && data.messages) {
        console.log('Setting messages:', data.messages.length, 'messages');
        setMessages(data.messages);
        // Mark unread messages as read
        const unreadIds = data.messages
          .filter((m: Message) => m.recipient_id === userId && !m.read_at)
          .map((m: Message) => m.id);

        if (unreadIds.length > 0) {
          await markAsRead(unreadIds);
        }
      } else {
        console.log('No messages data in response or data.ok is false');
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const markAsRead = async (messageIds: string[]) => {
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return;

      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      await fetch(`/api/orgs/${orgId}/messages`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ messageIds }),
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const sendMessage = async () => {
    console.log('sendMessage called - adminId:', adminId, 'currentUserId:', currentUserId, 'message:', newMessage.trim());
    if (!newMessage.trim() || !adminId || !currentUserId) {
      console.log('sendMessage early return - missing:', !newMessage.trim() ? 'message' : !adminId ? 'adminId' : 'currentUserId');
      return;
    }

    setSending(true);
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return;

      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      console.log('Sending message from member:', currentUserId, 'to admin:', adminId);

      const response = await fetch(`/api/orgs/${orgId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          recipientId: adminId,
          messageText: newMessage.trim(),
          propertyId: selectedPropertyId,
        }),
      });

      const data = await response.json();
      console.log('Message send response:', data);

      if (data.ok && data.message) {
        setMessages([...messages, data.message]);
        setNewMessage('');
        // Clear draft for this property
        const propertyKey = selectedPropertyId || 'all';
        setDraftMessages(prev => {
          const newDrafts = { ...prev };
          delete newDrafts[propertyKey];
          return newDrafts;
        });
        scrollToBottom();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleLogout = async () => {
    await sb.auth.signOut();
    router.push('/login');
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle scroll detection for "scroll to bottom" button
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Save draft messages when switching properties
  useEffect(() => {
    const propertyKey = selectedPropertyId || 'all';
    const savedDraft = draftMessages[propertyKey] || '';
    setNewMessage(savedDraft);
  }, [selectedPropertyId, draftMessages]);

  // Update draft when message changes
  const handleMessageChange = (value: string) => {
    setNewMessage(value);
    const propertyKey = selectedPropertyId || 'all';
    setDraftMessages(prev => ({
      ...prev,
      [propertyKey]: value
    }));
  };

  // Add reaction to a message
  const addReaction = async (messageId: string, emoji: string) => {
    if (!currentUserId) return;

    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return;

      const message = messages.find(m => m.id === messageId);
      if (!message) return;

      const reactions = message.reactions || [];
      const existingReaction = reactions.find(r => r.user_id === currentUserId && r.emoji === emoji);

      // If user already reacted with this emoji, remove it (toggle)
      const newReactions = existingReaction
        ? reactions.filter(r => !(r.user_id === currentUserId && r.emoji === emoji))
        : [...reactions, { emoji, user_id: currentUserId, created_at: new Date().toISOString() }];

      // Optimistically update UI
      setMessages(messages.map(m =>
        m.id === messageId ? { ...m, reactions: newReactions } : m
      ));

      // Update in database
      const { error } = await sb
        .from('messages')
        .update({ reactions: newReactions })
        .eq('id', messageId);

      if (error) {
        console.error('Error updating reaction:', error);
        // Revert on error
        setMessages(messages.map(m =>
          m.id === messageId ? { ...m, reactions: reactions } : m
        ));
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F8F6F2] via-[#E1ECDB]/30 to-[#9db896]/20 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F6F2] via-[#E1ECDB]/30 to-[#9db896]/20">
      {/* Header */}
      <div className="bg-white border-b border-border shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Image
                src="/truhost-logo.png"
                alt="TruHost Logo"
                width={380}
                height={106}
                className="h-16 w-auto object-contain"
                priority
              />
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Messages</p>
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-2 h-2 rounded-full animate-ping opacity-75" style={{ backgroundColor: '#6b9b7a' }}></div>
                  <div className="relative w-2 h-2 rounded-full" style={{ backgroundColor: '#6b9b7a' }}></div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={() => router.push(`/portal/${orgId}`)}
                variant="outline"
                size="sm"
              >
                ← Back to Dashboard
              </Button>
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="border-border hover:border-destructive hover:text-destructive"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="h-[calc(100vh-200px)] flex flex-col">
          <CardHeader className="pb-4 border-b bg-gradient-to-r from-primary/5 to-primary/10">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Chat with TruHost Admin</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {messages.filter(m => !selectedPropertyId || m.property_id === selectedPropertyId).length} message(s)
                  </p>
                </div>
              </div>
              {/* Search Bar */}
              <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-border">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-muted-foreground">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search messages..."
                  className="flex-1 px-2 py-1 text-sm border-0 focus:outline-none focus:ring-0 bg-transparent"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>

              {properties.length > 0 && (
                <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-border">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-muted-foreground">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                  <label className="text-sm font-medium text-muted-foreground">Filter by Property:</label>
                  <select
                    value={selectedPropertyId || ''}
                    onChange={(e) => setSelectedPropertyId(e.target.value || null)}
                    className="flex-1 px-2 py-1 text-sm border-0 focus:outline-none focus:ring-0 bg-transparent font-medium"
                  >
                    <option value="">All Properties</option>
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </CardHeader>

          {/* Messages Area */}
          <CardContent ref={messagesContainerRef} className="flex-1 overflow-y-auto p-6 space-y-4 relative">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                <p className="text-sm">Loading messages...</p>
              </div>
            ) : messages
              .filter(m => !selectedPropertyId || m.property_id === selectedPropertyId)
              .filter(m => !searchQuery || m.message_text.toLowerCase().includes(searchQuery.toLowerCase()))
              .length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mb-4 opacity-20">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <p className="text-lg font-medium">{searchQuery ? 'No messages found' : 'No messages yet'}</p>
                <p className="text-sm">{searchQuery ? 'Try a different search term' : 'Start a conversation with your TruHost admin'}</p>
              </div>
            ) : (
              <>
                {groupMessagesByDate(
                  messages
                    .filter(m => !selectedPropertyId || m.property_id === selectedPropertyId)
                    .filter(m => !searchQuery || m.message_text.toLowerCase().includes(searchQuery.toLowerCase()))
                ).map((group) => (
                  <div key={group.date} className="space-y-4">
                    {/* Date divider */}
                    <div className="flex items-center gap-3 my-6">
                      <div className="flex-1 border-t border-border" />
                      <span className="text-xs font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
                        {group.date}
                      </span>
                      <div className="flex-1 border-t border-border" />
                    </div>

                    {/* Messages in this date group */}
                    {group.messages.map((message) => {
                      const isCurrentUser = message.sender_id === currentUserId;
                      const propertyName = message.property_id
                        ? properties.find(p => p.id === message.property_id)?.name
                        : null;

                      return (
                        <div
                          key={message.id}
                          className={`group flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className="flex flex-col">
                            <div className={`flex items-center gap-2 mb-1 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                              <span className="text-xs font-medium text-muted-foreground">
                                {isCurrentUser ? 'You' : 'TruHost Admin'}
                              </span>
                              {propertyName && !selectedPropertyId && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                  {propertyName}
                                </span>
                              )}
                              {message.read_at && !isCurrentUser && (
                                <span className="text-xs text-muted-foreground">✓✓</span>
                              )}
                            </div>
                            <div>
                              <div
                                className={`inline-block max-w-[600px] min-w-[80px] rounded-2xl px-4 py-3 shadow-md ${
                                  isCurrentUser
                                    ? 'bg-primary text-primary-foreground rounded-tr-md'
                                    : 'bg-white border border-border rounded-tl-md'
                                }`}
                              >
                                <p className="text-base leading-relaxed whitespace-pre-wrap">{message.message_text}</p>
                                <p className={`text-xs mt-3 ${isCurrentUser ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                  {new Date(message.created_at).toLocaleString('en-US', {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </>
            )}
            <div ref={messagesEndRef} />

            {/* Scroll to bottom button */}
            {showScrollButton && (
              <button
                onClick={scrollToBottom}
                className="absolute bottom-4 right-4 bg-primary text-primary-foreground rounded-full p-3 shadow-lg hover:bg-primary/90 transition-all duration-200 hover:scale-110"
                aria-label="Scroll to bottom"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 5v14M19 12l-7 7-7-7" />
                </svg>
              </button>
            )}
          </CardContent>

          {/* Message Input */}
          <div className="border-t bg-gray-50">
            {!adminId && !loading && (
              <div className="px-4 pt-3 pb-2">
                {isOwner ? (
                  <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2 border border-blue-200">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4M12 8h.01" />
                    </svg>
                    <span>You are the admin. Use the <button onClick={() => router.push(`/admin/${orgId}/messages`)} className="underline font-medium hover:text-blue-800">Admin Portal</button> to manage conversations with members.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>Unable to connect to admin. Please refresh the page or contact support.</span>
                  </div>
                )}
              </div>
            )}
            {selectedPropertyId && (
              <div className="px-4 pt-3 pb-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-white rounded-lg px-3 py-2 border border-border">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                  <span>Messaging about:</span>
                  <span className="font-medium text-primary">
                    {properties.find(p => p.id === selectedPropertyId)?.name}
                  </span>
                </div>
              </div>
            )}
            <div className="p-4 pt-2">
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => handleMessageChange(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !sending && sendMessage()}
                  placeholder={selectedPropertyId ? "Type your message..." : "Type your message (applies to all properties)..."}
                  disabled={sending}
                  className="flex-1 px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white shadow-sm"
                />
                <Button
                  onClick={sendMessage}
                  disabled={sending || !newMessage.trim() || !adminId}
                  className="px-6 py-3 shadow-sm h-[46px]"
                >
                  {sending ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Sending
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>Send</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </div>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
