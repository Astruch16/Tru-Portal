'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';

type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  message_text: string;
  created_at: string;
  read_at: string | null;
  property_id: string | null;
};

type Property = {
  id: string;
  name: string;
};

type UserProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
};

type Conversation = {
  userId: string;
  userName: string;
  userEmail: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  messages: Message[];
  properties: Property[];
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

export default function AdminMessagesPage({ params }: { params: Promise<{ orgid: string }> }) {
  const [orgId, setOrgId] = useState<string>('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
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
      // Get current user (admin)
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setCurrentUserId(user.id);

      // Fetch all properties in the org
      const { data: { session } } = await sb.auth.getSession();
      if (session) {
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

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

      // Fetch all messages and organize into conversations
      await fetchConversations(user.id);
      setLoading(false);

      // Set up polling to check for new messages every 5 seconds
      const pollInterval = setInterval(() => {
        fetchConversations(user.id, true);
      }, 5000);

      return () => clearInterval(pollInterval);
    };

    init();
  }, [orgId, sb, router]);

  const fetchConversations = async (adminId: string, keepSelection = false) => {
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return;

      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      // Use the new conversations API that fetches everything server-side
      const response = await fetch(`/api/orgs/${orgId}/messages/conversations`, { headers });
      const data = await response.json();

      if (data.ok && data.conversations) {
        setConversations(data.conversations);

        // If we're keeping selection and there's a selected conversation, update it with new messages
        if (keepSelection && selectedConversation) {
          const updatedConvo = data.conversations.find((c: Conversation) => c.userId === selectedConversation.userId);
          if (updatedConvo) {
            setSelectedConversation(updatedConvo);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
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
    if (!newMessage.trim() || !selectedConversation || !currentUserId) return;

    setSending(true);
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return;

      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/orgs/${orgId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          recipientId: selectedConversation.userId,
          messageText: newMessage,
          propertyId: selectedPropertyId
        }),
      });

      if (response.ok) {
        setNewMessage('');
        // Clear draft for this conversation
        const conversationKey = selectedConversation.userId;
        setDraftMessages(prev => {
          const newDrafts = { ...prev };
          delete newDrafts[conversationKey];
          return newDrafts;
        });
        // Refresh conversations and keep the same conversation selected
        await fetchConversations(currentUserId, true);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleLogout = async () => {
    await sb.auth.signOut();
    router.push('/login');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (selectedConversation) {
      scrollToBottom();
      // Mark messages as read
      const unreadIds = selectedConversation.messages
        .filter((m: Message) => m.sender_id === selectedConversation.userId && !m.read_at)
        .map((m: Message) => m.id);

      if (unreadIds.length > 0) {
        markAsRead(unreadIds);
      }
    }
  }, [selectedConversation]);

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

  // Save draft messages when switching conversations
  useEffect(() => {
    if (!selectedConversation) return;
    const conversationKey = selectedConversation.userId;
    const savedDraft = draftMessages[conversationKey] || '';
    setNewMessage(savedDraft);
  }, [selectedConversation, draftMessages]);

  // Update draft when message changes
  const handleMessageChange = (value: string) => {
    if (!selectedConversation) return;
    setNewMessage(value);
    const conversationKey = selectedConversation.userId;
    setDraftMessages(prev => ({
      ...prev,
      [conversationKey]: value
    }));
  };

  const selectConversation = (convo: Conversation) => {
    setSelectedConversation(convo);
    setSelectedPropertyId(null);
    setSearchQuery('');
  };

  // Filter conversations by search query
  const filteredConversations = conversations.filter(convo =>
    convo.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    convo.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
    convo.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F6F2] via-[#E1ECDB]/30 to-[#9db896]/20">
      {/* Header */}
      <div className="bg-white border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
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
                <p className="text-sm text-muted-foreground">Admin Messages</p>
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-2 h-2 rounded-full animate-ping opacity-75" style={{ backgroundColor: '#6b9b7a' }}></div>
                  <div className="relative w-2 h-2 rounded-full" style={{ backgroundColor: '#6b9b7a' }}></div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={() => router.push(`/admin/${orgId}`)}
                variant="outline"
                size="sm"
              >
                ← Back to Admin Portal
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

      <div className="flex h-[calc(100vh-80px)]">
        {/* Conversations List */}
        <div className="w-96 border-r border-border bg-white overflow-y-auto">
          {/* Search */}
          <div className="p-4 border-b border-border sticky top-0 bg-white z-10">
            <div className="relative">
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pr-10 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Conversation Items */}
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="text-sm">{searchQuery ? 'No conversations found' : 'No messages yet'}</p>
            </div>
          ) : (
            filteredConversations.map((convo) => (
              <div
                key={convo.userId}
                onClick={() => selectConversation(convo)}
                className={`p-4 border-b border-border cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-md ${
                  selectedConversation?.userId === convo.userId
                    ? 'bg-primary/5 border-l-4 border-l-primary scale-[1.02] shadow-md'
                    : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{convo.userName}</h3>
                    {convo.unreadCount > 0 && (
                      <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                        {convo.unreadCount > 9 ? '9+' : convo.unreadCount}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(convo.lastMessageTime).toLocaleString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {convo.properties && convo.properties.length > 0 && (
                  <p className="text-xs text-muted-foreground mb-1">{convo.properties[0].name}</p>
                )}
                <p className="text-sm text-muted-foreground truncate">{convo.lastMessage}</p>
              </div>
            ))
          )}
        </div>

        {/* Messages Area */}
        <div className="flex-1 flex flex-col">
          {!selectedConversation ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mx-auto mb-4 opacity-20">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm">Choose a member to view your conversation</p>
              </div>
            </div>
          ) : (
            <>
              <CardHeader className="border-b border-border bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{selectedConversation.userName}</CardTitle>
                  </div>

                  {selectedConversation.properties && selectedConversation.properties.length > 0 && (
                    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-border">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-muted-foreground">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                      <label className="text-sm font-medium text-muted-foreground">Property:</label>
                      {selectedConversation.properties.length === 1 ? (
                        <span className="text-sm font-medium text-foreground">
                          {selectedConversation.properties[0].name}
                        </span>
                      ) : (
                        <select
                          value={selectedPropertyId || ''}
                          onChange={(e) => setSelectedPropertyId(e.target.value || null)}
                          className="flex-1 px-2 py-1 text-sm border-0 focus:outline-none focus:ring-0 bg-transparent font-medium"
                        >
                          <option value="">None</option>
                          {selectedConversation.properties.map((property) => (
                            <option key={property.id} value={property.id}>
                              {property.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>

              {/* Messages */}
              <CardContent ref={messagesContainerRef} className="flex-1 overflow-y-auto p-6 space-y-4 relative">
                {groupMessagesByDate(selectedConversation.messages).map((group) => (
                  <div key={group.date} className="space-y-4">
                    {/* Date divider */}
                    <div className="flex items-center gap-3 my-6">
                      <div className="flex-1 border-t border-border" />
                      <span className="text-xs font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
                        {group.date}
                      </span>
                      <div className="flex-1 border-t border-border" />
                    </div>

                    {/* Messages */}
                    {group.messages.map((message) => {
                      const isCurrentUser = message.sender_id === currentUserId;
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-muted-foreground">
                                {isCurrentUser ? 'You' : selectedConversation.userName}
                              </span>
                              {isCurrentUser && message.read_at && (
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
                <div ref={messagesEndRef} />

                {/* Scroll to bottom button */}
                {showScrollButton && (
                  <button
                    onClick={scrollToBottom}
                    className="fixed bottom-32 right-8 bg-primary text-primary-foreground rounded-full p-3 shadow-lg hover:shadow-xl transition-all animate-bounce"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M12 5v14M19 12l-7 7-7-7" />
                    </svg>
                  </button>
                )}
              </CardContent>

              {/* Input Area */}
              <div className="border-t border-border bg-white p-4">
                <div className="flex gap-3 items-center">
                  <textarea
                    value={newMessage}
                    onChange={(e) => handleMessageChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-3 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                    rows={3}
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sending}
                    className="px-6 py-3 h-[52px] bg-primary hover:bg-primary/90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                    style={{ backgroundColor: !newMessage.trim() || sending ? undefined : '#6b9b7a' }}
                  >
                    {sending ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Sending</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>Send</span>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                        </svg>
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
