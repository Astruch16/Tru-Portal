'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabaseClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Image from 'next/image';

type Tier = 'launch' | 'elevate' | 'maximize';
const TIER_LABEL: Record<Tier, string> = {
  launch: 'Launch (12%)',
  elevate: 'Elevate (18%)',
  maximize: 'Maximize (22%)',
};

type Role = 'owner' | 'manager' | 'member';

export default function AdminPage() {
  const p = useParams<{ orgid: string }>();
  const router = useRouter();
  const sb = supabaseClient();
  const orgId = (p?.orgid ?? '').toString();

  // --- Shared UI state ---
  const [msg, setMsg] = useState<string | null>(null);

  // --- Generate state ---
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  // --- Payments state ---
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('0');

  // --- Invite state ---
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('TempPass123!');
  const [inviteRole, setInviteRole] = useState<Role>('member');
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [invitePlan, setInvitePlan] = useState<Tier>('launch');
  const [busyInvite, setBusyInvite] = useState(false);

  // --- Property state ---
  const [propertyName, setPropertyName] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [propertyAirbnbLink, setPropertyAirbnbLink] = useState('');
  const [properties, setProperties] = useState<any[]>([]);
  const [busyProperty, setBusyProperty] = useState(false);

  // --- Assign Property state ---
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [users, setUsers] = useState<any[]>([]);

  // --- Booking state ---
  const [bookingPropertyId, setBookingPropertyId] = useState('');
  const [bookingCheckIn, setBookingCheckIn] = useState('');
  const [bookingCheckOut, setBookingCheckOut] = useState('');
  const [bookingStatus, setBookingStatus] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');
  const [bookings, setBookings] = useState<any[]>([]);
  const [busyBooking, setBusyBooking] = useState(false);

  // --- Invoice list state ---
  const [invoices, setInvoices] = useState<any[]>([]);

  // --- Revenue/Expense state ---
  const [ledgerPropertyId, setLedgerPropertyId] = useState('');
  const [ledgerAmount, setLedgerAmount] = useState('');
  const [ledgerDescription, setLedgerDescription] = useState('');
  const [ledgerDate, setLedgerDate] = useState(new Date().toISOString().slice(0, 10));
  const [ledgerCategory, setLedgerCategory] = useState<'revenue' | 'expense'>('revenue');
  const [busyLedger, setBusyLedger] = useState(false);

  // --- Receipt state ---
  const [receiptPropertyId, setReceiptPropertyId] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [busyReceipt, setBusyReceipt] = useState(false);

  // --- User modal state ---
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);

  // --- Property modal state ---
  const [selectedProperty, setSelectedProperty] = useState<any | null>(null);
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [propertyKpis, setPropertyKpis] = useState<any>(null);
  const [propertyMonth, setPropertyMonth] = useState(new Date().toISOString().slice(0, 7));

  // --- Actions ---
  async function generate() {
    if (!orgId) { setMsg('Missing org id in the URL: visit /admin/<ORG_ID>'); return; }
    setMsg('Generating…');
    try {
      const res = await fetch(`/api/orgs/${orgId}/invoices/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      });
      let jUnknown: unknown = null;
      try { jUnknown = await res.json(); } catch {}
      const j = (jUnknown && typeof jUnknown === 'object') ? (jUnknown as Record<string, unknown>) : {};
      if (!res.ok) { setMsg(`Error ${res.status}: ${(j['error'] as string) || 'Failed to generate'}`); return; }
      const inv = j['invoice'] as { id?: string } | undefined;
      setMsg(`✓ Generated invoice: ${inv?.id || '(no id)'}`);
    } catch (e) { setMsg(`Network error: ${(e as Error).message}`); }
  }

  async function downloadForMonth() {
    if (!orgId) { setMsg('Missing org id in the URL: visit /admin/<ORG_ID>'); return; }
    setMsg('Preparing PDF…');
    try {
      const genRes = await fetch(`/api/orgs/${orgId}/invoices/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      });
      let genUnknown: unknown = null;
      try { genUnknown = await genRes.json(); } catch {}
      const gen = (genUnknown && typeof genUnknown === 'object') ? (genUnknown as Record<string, unknown>) : {};
      if (!genRes.ok) { setMsg(`Generate failed (${genRes.status}): ${(gen['error'] as string) || 'Unknown error'}`); return; }
      const invObj = gen['invoice'] as Record<string, unknown> | undefined;
      const id = (invObj?.['id'] as string) || (gen['id'] as string) || '';
      if (!id) { setMsg('Could not determine invoice id for this month'); return; }

      const linkRes = await fetch(`/api/invoices/${id}/pdf-link`);
      let linkUnknown: unknown = null;
      try { linkUnknown = await linkRes.json(); } catch {}
      const link = (linkUnknown && typeof linkUnknown === 'object') ? (linkUnknown as Record<string, unknown>) : {};
      const url = typeof link['url'] === 'string' ? (link['url'] as string) : '';
      if (!linkRes.ok || !url) { setMsg(`Link error (${linkRes.status}): ${(link['message'] as string) || (link['error'] as string) || 'No URL returned'}`); return; }

      window.open(url, '_blank', 'noopener,noreferrer');
      setMsg('✓ Opened invoice PDF in a new tab.');
    } catch (e) { setMsg(`Download error: ${(e as Error).message}`); }
  }

  async function pay() {
    if (!invoiceId) { setMsg('Enter invoice id'); return; }
    const amt = parseInt(amount, 10);
    if (!Number.isFinite(amt) || amt <= 0) { setMsg('Enter amount_cents > 0'); return; }
    setMsg('Posting payment…');
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_cents: amt, method: 'bank' }),
      });
      const j = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) { setMsg(`Error ${res.status}: ${(j['error'] as string) || 'Failed to record payment'}`); return; }
      setMsg(`✓ Payment recorded. Status: ${(j['invoice'] as Record<string, unknown> | undefined)?.['status'] as string}`);
    } catch (e) { setMsg(`Network error: ${(e as Error).message}`); }
  }

  async function invite() {
    if (!orgId) { setMsg('Missing org id in URL'); return; }
    if (!inviteEmail || !invitePassword) { setMsg('Email and password are required'); return; }
    if (!inviteFirstName || !inviteLastName) { setMsg('First and last name are required'); return; }
    setBusyInvite(true); setMsg('Creating user…');
    try {
      const res = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          password: invitePassword,
          org_id: orgId,
          role: inviteRole,
          first_name: inviteFirstName,
          last_name: inviteLastName,
          plan_tier: invitePlan,
        }),
      });
      const j = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) {
        setMsg(`Invite error ${res.status}: ${(j['error'] as string) || 'failed'}`);
      } else {
        const uid = (j['user'] as Record<string, unknown> | undefined)?.['id'] as string | undefined;
        setMsg(`✓ User created: ${uid || '(no id)'} — Plan: ${invitePlan} assigned`);
        setInviteEmail('');
        setInviteFirstName('');
        setInviteLastName('');
      }
    } catch (e) {
      setMsg(`Network error: ${(e as Error).message}`);
    } finally {
      setBusyInvite(false);
    }
  }

  const handleLogout = async () => {
    await sb.auth.signOut();
    router.push('/login');
  };

  // --- Data fetching ---
  useEffect(() => {
    if (orgId) {
      fetchProperties();
      fetchUsers();
      fetchBookings();
      fetchInvoices();
    }
  }, [orgId]);

  // Auto-refresh users when window gains focus (to catch avatar updates)
  useEffect(() => {
    const handleFocus = () => {
      if (orgId) {
        fetchUsers();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [orgId]);

  async function fetchProperties() {
    try {
      const res = await fetch(`/api/orgs/${orgId}/properties/list`);
      const j = await res.json();
      if (res.ok) setProperties(j.properties || []);
    } catch (e) {
      console.error('Failed to fetch properties:', e);
    }
  }

  async function fetchUsers() {
    try {
      const res = await fetch(`/api/orgs/${orgId}/users`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      const j = await res.json();
      console.log('Fetched users from API:', j.users);
      if (res.ok) {
        // Add cache-busting timestamp to avatar URLs to force image refresh
        const timestamp = Date.now();
        const usersWithFreshAvatars = (j.users || []).map((user: any) => {
          const freshUrl = user.avatar_url ? `${user.avatar_url.split('?')[0]}?t=${timestamp}` : null;
          console.log(`User ${user.first_name}: avatar ${user.avatar_url} -> ${freshUrl}`);
          return {
            ...user,
            avatar_url: freshUrl
          };
        });
        setUsers(usersWithFreshAvatars);
        console.log('Users state updated with', usersWithFreshAvatars?.length, 'users');
      }
    } catch (e) {
      console.error('Failed to fetch users:', e);
    }
  }

  async function fetchBookings() {
    try {
      const res = await fetch(`/api/orgs/${orgId}/bookings`);
      const j = await res.json();
      if (res.ok) setBookings(j.bookings || []);
    } catch (e) {
      console.error('Failed to fetch bookings:', e);
    }
  }

  async function fetchInvoices() {
    try {
      const res = await fetch(`/api/orgs/${orgId}/invoices/list`);
      const j = await res.json();
      if (res.ok) setInvoices(j.invoices || []);
    } catch (e) {
      console.error('Failed to fetch invoices:', e);
    }
  }

  // --- Property actions ---
  async function addProperty() {
    if (!propertyName.trim()) { setMsg('Property name is required'); return; }
    setBusyProperty(true); setMsg('Adding property…');
    try {
      const res = await fetch(`/api/orgs/${orgId}/properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: propertyName,
          address: propertyAddress,
          property_type: propertyType,
          airbnb_link: propertyAirbnbLink || null
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setMsg(`Error ${res.status}: ${j.error || 'Failed to add property'}`);
      } else {
        setMsg(`✓ Property added: ${j.property.name}`);
        setPropertyName('');
        setPropertyAddress('');
        setPropertyType('');
        setPropertyAirbnbLink('');
        fetchProperties();
      }
    } catch (e) {
      setMsg(`Network error: ${(e as Error).message}`);
    } finally {
      setBusyProperty(false);
    }
  }

  async function deleteProperty(propertyId: string) {
    if (!confirm('Are you sure you want to delete this property?')) return;
    try {
      const res = await fetch(`/api/orgs/${orgId}/properties`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId }),
      });
      const j = await res.json();
      if (res.ok) {
        setMsg('✓ Property deleted');
        fetchProperties();
      } else {
        setMsg(`Error: ${j.error}`);
      }
    } catch (e) {
      setMsg(`Network error: ${(e as Error).message}`);
    }
  }

  // --- Assign Property action ---
  async function assignProperty() {
    if (!selectedPropertyId || !selectedUserId) {
      setMsg('Please select both a property and a user');
      return;
    }
    setMsg('Assigning property…');
    try {
      const res = await fetch('/api/admin/user-properties/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedUserId, property_id: selectedPropertyId }),
      });
      const j = await res.json();
      if (res.ok) {
        setMsg('✓ Property assigned to user');
        setSelectedPropertyId('');
        setSelectedUserId('');
      } else {
        setMsg(`Error: ${j.error || 'Failed to assign property'}`);
      }
    } catch (e) {
      setMsg(`Network error: ${(e as Error).message}`);
    }
  }

  // --- Booking actions ---
  async function addBooking() {
    if (!bookingPropertyId || !bookingCheckIn || !bookingCheckOut) {
      setMsg('Please fill in all booking fields');
      return;
    }
    setBusyBooking(true); setMsg('Adding booking…');
    try {
      const res = await fetch(`/api/orgs/${orgId}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: bookingPropertyId,
          check_in: bookingCheckIn,
          check_out: bookingCheckOut,
          status: bookingStatus,
        }),
      });
      const j = await res.json();
      if (res.ok) {
        setMsg('✓ Booking added');
        setBookingPropertyId('');
        setBookingCheckIn('');
        setBookingCheckOut('');
        fetchBookings();
      } else {
        setMsg(`Error: ${j.error || 'Failed to add booking'}`);
      }
    } catch (e) {
      setMsg(`Network error: ${(e as Error).message}`);
    } finally {
      setBusyBooking(false);
    }
  }

  async function updateBookingStatus(bookingId: string, newStatus: 'upcoming' | 'completed' | 'cancelled') {
    try {
      const res = await fetch(`/api/orgs/${orgId}/bookings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, status: newStatus }),
      });
      if (res.ok) {
        setMsg(`✓ Booking status updated to ${newStatus}`);
        fetchBookings();
      } else {
        const j = await res.json();
        setMsg(`Error: ${j.error}`);
      }
    } catch (e) {
      setMsg(`Network error: ${(e as Error).message}`);
    }
  }

  // --- Ledger actions ---
  async function addLedgerEntry() {
    if (!ledgerPropertyId || !ledgerAmount || !ledgerDescription) {
      setMsg('Please fill in all fields for revenue/expense');
      return;
    }
    const amountCents = parseInt(ledgerAmount, 10);
    if (!Number.isFinite(amountCents)) {
      setMsg('Amount must be a valid number');
      return;
    }
    setBusyLedger(true); setMsg('Adding entry…');
    try {
      const res = await fetch(`/api/orgs/${orgId}/ledger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: ledgerPropertyId,
          amount_cents: ledgerCategory === 'revenue' ? amountCents : -amountCents,
          description: ledgerDescription,
          entry_date: ledgerDate,
          category: ledgerCategory,
        }),
      });
      const j = await res.json();
      if (res.ok) {
        setMsg(`✓ ${ledgerCategory === 'revenue' ? 'Revenue' : 'Expense'} added`);
        setLedgerPropertyId('');
        setLedgerAmount('');
        setLedgerDescription('');
      } else {
        setMsg(`Error: ${j.error || 'Failed to add entry'}`);
      }
    } catch (e) {
      setMsg(`Network error: ${(e as Error).message}`);
    } finally {
      setBusyLedger(false);
    }
  }

  // --- Receipt actions ---
  async function uploadReceipt() {
    if (!receiptPropertyId || !receiptFile) {
      setMsg('Please select a property and a file');
      return;
    }
    setBusyReceipt(true); setMsg('Uploading receipt…');
    try {
      const formData = new FormData();
      formData.append('file', receiptFile);
      formData.append('property_id', receiptPropertyId);

      const res = await fetch(`/api/orgs/${orgId}/receipts/upload`, {
        method: 'POST',
        body: formData,
      });
      const j = await res.json();
      if (res.ok) {
        setMsg('✓ Receipt uploaded');
        setReceiptPropertyId('');
        setReceiptFile(null);
      } else {
        setMsg(`Error: ${j.error || 'Failed to upload receipt'}`);
      }
    } catch (e) {
      setMsg(`Network error: ${(e as Error).message}`);
    } finally {
      setBusyReceipt(false);
    }
  }

  // --- User modal ---
  const [updatingPlan, setUpdatingPlan] = useState(false);
  const [selectedPlanTier, setSelectedPlanTier] = useState<Tier | ''>('');

  async function openUserModal(user: any) {
    setSelectedUser(user);
    setSelectedPlanTier(user.plan_tier || '');
    setShowUserModal(true);
  }

  async function openPropertyModal(property: any) {
    setSelectedProperty(property);
    setShowPropertyModal(true);
    // Fetch KPIs for this property
    try {
      const res = await fetch(`/api/orgs/${orgId}/properties/${property.id}/kpis?month=${propertyMonth}`);
      const data = await res.json();
      if (res.ok) {
        setPropertyKpis(data.kpis || null);
      }
    } catch (e) {
      console.error('Failed to fetch property KPIs:', e);
    }
  }

  async function updateUserPlan() {
    if (!selectedUser || !selectedPlanTier) {
      setMsg('Please select a plan tier');
      return;
    }

    setUpdatingPlan(true);
    setMsg('Updating plan...');

    const requestData = {
      user_id: selectedUser.id,
      org_id: orgId,
      plan_tier: selectedPlanTier,
    };

    console.log('Updating plan with data:', requestData);

    try {
      const res = await fetch(`/api/admin/users/set-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      const j = await res.json();
      console.log('Set plan response:', { status: res.status, ok: res.ok, data: j });

      if (res.ok) {
        setMsg('✓ Plan updated successfully');

        // Calculate the percentage for the selected tier
        const percentMap: Record<Tier, number> = { launch: 12, elevate: 18, maximize: 22 };
        const plan_percent = percentMap[selectedPlanTier];

        console.log('Updating local state with:', { plan_tier: selectedPlanTier, plan_percent });

        // Update the selected user's plan in the modal
        setSelectedUser({
          ...selectedUser,
          plan_tier: selectedPlanTier,
          plan_percent: plan_percent
        });

        // Refresh users list to reflect changes in the grid
        console.log('Fetching updated users list...');
        await fetchUsers();

        setTimeout(() => setMsg(''), 3000);
      } else {
        console.error('Failed to update plan:', j);
        setMsg(`Error: ${j.error || 'Failed to update plan'}`);
      }
    } catch (e) {
      console.error('Network error updating plan:', e);
      setMsg(`Network error: ${(e as Error).message}`);
    } finally {
      setUpdatingPlan(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F6F2] via-[#E1ECDB]/20 to-[#E1ECDB]/40">
      {/* Geometric pattern overlay */}
      <div className="fixed inset-0 opacity-[0.15] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23E1ECDB' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        backgroundSize: '60px 60px'
      }}></div>

      {/* Header */}
      <div className="bg-white border-b border-border shadow-sm relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* TruHost Logo */}
              <Image
                src="/truhost-logo.png"
                alt="TruHost Logo"
                width={380}
                height={106}
                className="h-20 w-auto object-contain transition-transform hover:scale-105"
                priority
              />
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Admin Portal</p>
                {/* Pulsing green dot */}
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-2 h-2 rounded-full animate-ping opacity-75" style={{ backgroundColor: '#6b9b7a' }}></div>
                  <div className="relative w-2 h-2 rounded-full" style={{ backgroundColor: '#6b9b7a' }}></div>
                </div>
              </div>
            </div>
            {/* Logout Button */}
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="border-border hover:border-destructive hover:text-destructive hover:bg-destructive/5 transition-all duration-300 cursor-pointer"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mr-2">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </Button>
          </div>

          <Separator className="mt-1 mb-4 bg-border" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto relative p-4">

        {/* Status Message */}
        {msg && (
          <Card className="mb-6 border-border/50 bg-card/80 backdrop-blur-sm">
            <div className="p-4">
              <p className="text-sm text-foreground">{msg}</p>
            </div>
          </Card>
        )}

        <div className="space-y-4">
          {/* Members Section */}
          <CollapsibleSection
            title="Members"
            description="Manage team members and permissions"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
            defaultOpen={true}
          >
            <div className="space-y-6">
              {/* Invite Member */}
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Invite Member
                </h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="invite-first-name">First Name</Label>
                    <Input
                      id="invite-first-name"
                      type="text"
                      placeholder="John"
                      value={inviteFirstName}
                      onChange={(e) => setInviteFirstName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-last-name">Last Name</Label>
                    <Input
                      id="invite-last-name"
                      type="text"
                      placeholder="Doe"
                      value={inviteLastName}
                      onChange={(e) => setInviteLastName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="user@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-password">Temporary Password</Label>
                    <Input
                      id="invite-password"
                      type="text"
                      placeholder="TempPass123!"
                      value={invitePassword}
                      onChange={(e) => setInvitePassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-role">Role</Label>
                    <select
                      id="invite-role"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as Role)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                    >
                      <option value="member">Member</option>
                      <option value="manager">Manager</option>
                      <option value="owner">Owner</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-plan">Plan Tier</Label>
                    <select
                      id="invite-plan"
                      value={invitePlan}
                      onChange={(e) => setInvitePlan(e.target.value as Tier)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                    >
                      <option value="launch">{TIER_LABEL.launch}</option>
                      <option value="elevate">{TIER_LABEL.elevate}</option>
                      <option value="maximize">{TIER_LABEL.maximize}</option>
                    </select>
                  </div>
                </div>
                <Button onClick={invite} disabled={busyInvite} className="mt-4 cursor-pointer">
                  {busyInvite ? 'Inviting…' : 'Send Invitation'}
                </Button>
              </div>

              <Separator />

              {/* Users */}
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  All Users
                </h3>
                {users.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No users yet.</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {users.map((user) => (
                      <Card
                        key={user.id}
                        className="group relative overflow-hidden border-border/50 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-sm cursor-pointer hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
                        onClick={() => openUserModal(user)}
                      >
                        {/* Decorative gradient */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-full -mr-16 -mt-16 group-hover:from-primary/20 transition-colors duration-300"></div>

                        <div className="relative p-5 space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="relative">
                              <Avatar className="w-14 h-14 border-2 border-primary/20 group-hover:scale-105 transition-transform duration-300">
                                <AvatarImage src={user.avatar_url || undefined} />
                                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground text-lg font-semibold">
                                  {user.first_name?.[0]}{user.last_name?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              {/* Status indicator */}
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary rounded-full border-2 border-card"></div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-base truncate">{user.first_name} {user.last_name}</h4>
                              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="text-xs font-medium">
                              <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              {user.role}
                            </Badge>
                            {user.plan_tier && (
                              <Badge className="text-xs font-medium bg-gradient-to-r from-primary to-primary/80 text-primary-foreground border-0">
                                <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                </svg>
                                {TIER_LABEL[user.plan_tier as Tier]}
                              </Badge>
                            )}
                          </div>

                          {/* Click hint */}
                          <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                            <span>View Profile</span>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>

                        {/* Delete button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteUser(user.id);
                          }}
                          className="absolute bottom-3 right-3 p-2 rounded-md text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all duration-300 cursor-pointer group/delete"
                          aria-label="Delete user"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CollapsibleSection>

          {/* Properties Section */}
          <CollapsibleSection
            title="Properties"
            description="Manage properties and assignments"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
          >
            <div className="space-y-6">
              {/* Add Properties */}
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Property
                </h3>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <Label htmlFor="property-name">Property Name</Label>
                      <Input
                        id="property-name"
                        placeholder="Beach House"
                        value={propertyName}
                        onChange={(e) => setPropertyName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="property-address">Address</Label>
                      <Input
                        id="property-address"
                        placeholder="123 Ocean Drive"
                        value={propertyAddress}
                        onChange={(e) => setPropertyAddress(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="property-type">Property Type</Label>
                      <select
                        id="property-type"
                        value={propertyType}
                        onChange={(e) => setPropertyType(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                      >
                        <option value="">Select type...</option>
                        <option value="house">House</option>
                        <option value="apartment">Apartment</option>
                        <option value="condo">Condo</option>
                        <option value="villa">Villa</option>
                        <option value="cabin">Cabin</option>
                        <option value="basement_suite">Basement Suite</option>
                        <option value="garden_suite">Garden Suite</option>
                        <option value="carriage_house">Carriage House</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="property-airbnb-link">Airbnb Link (Optional)</Label>
                      <Input
                        id="property-airbnb-link"
                        placeholder="https://airbnb.com/..."
                        value={propertyAirbnbLink}
                        onChange={(e) => setPropertyAirbnbLink(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button onClick={addProperty} disabled={busyProperty} className="cursor-pointer">
                    {busyProperty ? 'Adding…' : 'Add Property'}
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Manage Properties */}
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  All Properties
                </h3>
                {properties.length === 0 ? (
                  <div className="text-center py-12 bg-muted/30 rounded-lg border-2 border-dashed border-border">
                    <svg className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <p className="text-sm font-medium text-muted-foreground mb-1">No properties yet</p>
                    <p className="text-xs text-muted-foreground">Add your first property using the form above</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {properties.map((prop, index) => {
                      // Function to get icon based on property type
                      const getPropertyIcon = (type: string) => {
                        switch(type) {
                          case 'house':
                            return (
                              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                              </svg>
                            );
                          case 'apartment':
                          case 'condo':
                            return (
                              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                            );
                          case 'villa':
                            return (
                              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                              </svg>
                            );
                          case 'cabin':
                            return (
                              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h18M4 18h16M6 6l6-3 6 3M6 6v12M18 6v12M9 10h6v8H9v-8z" />
                              </svg>
                            );
                          case 'basement_suite':
                            return (
                              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7M19 21V9m0 12h2m-2 0h-5m-9 0H3m2 0h5" />
                              </svg>
                            );
                          case 'garden_suite':
                            return (
                              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                              </svg>
                            );
                          case 'carriage_house':
                            return (
                              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                              </svg>
                            );
                          default:
                            return (
                              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                            );
                        }
                      };

                      return (
                        <Card
                          key={prop.id}
                          className="group relative overflow-hidden cursor-pointer transition-all duration-[800ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-1 hover:shadow-xl border-border/50 bg-gradient-to-br from-card via-card to-card/80 backdrop-blur-sm"
                          style={{
                            animation: 'fadeIn 0.5s ease-out forwards',
                            animationDelay: `${index * 100}ms`,
                            opacity: 0,
                          }}
                          onClick={() => openPropertyModal(prop)}
                        >
                          {/* Decorative gradient overlay */}
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-[800ms] ease-[cubic-bezier(0.4,0,0.2,1)]"></div>

                          {/* Decorative corner accent */}
                          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-full -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity duration-[800ms] ease-[cubic-bezier(0.4,0,0.2,1)]"></div>

                          <div className="relative p-5">
                            {/* Property Icon & Name */}
                            <div className="flex items-start gap-3 mb-3">
                              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-[800ms] ease-[cubic-bezier(0.4,0,0.2,1)]">
                                {getPropertyIcon(prop.property_type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-base mb-1 truncate group-hover:text-primary transition-colors duration-[800ms] ease-[cubic-bezier(0.4,0,0.2,1)]">
                                  {prop.name}
                                </h4>
                                {prop.address && (
                                  <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                    <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span className="line-clamp-2">{prop.address}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                          {/* Property Details */}
                          <div className="pt-3 mt-3 border-t border-border/50 space-y-2.5">
                            {/* Badges Row */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {prop.property_type && (
                                <Badge variant="secondary" className="text-xs font-medium border-primary/20 bg-primary/5 text-primary group-hover:border-primary/40 transition-colors duration-[800ms] ease-[cubic-bezier(0.4,0,0.2,1)]">
                                  <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                  </svg>
                                  {prop.property_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                                </Badge>
                              )}
                              {prop.airbnb_link && (
                                <Badge variant="outline" className="text-xs font-medium border-blue-200 bg-blue-50 text-blue-700">
                                  <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                  Airbnb
                                </Badge>
                              )}
                            </div>

                            {/* Assigned Member */}
                            <div className="flex items-center gap-2">
                              {prop.assigned_user ? (
                                <>
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    <span className="font-medium text-foreground truncate">
                                      {prop.assigned_user.first_name} {prop.assigned_user.last_name}
                                    </span>
                                  </div>
                                  <Badge variant="outline" className="text-xs border-green-200 bg-green-50 text-green-700 flex-shrink-0">
                                    Assigned
                                  </Badge>
                                </>
                              ) : (
                                <>
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    <span className="italic">Not assigned</span>
                                  </div>
                                  <Badge variant="outline" className="text-xs border-orange-200 bg-orange-50 text-orange-700 flex-shrink-0">
                                    Unassigned
                                  </Badge>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Click hint */}
                          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                            <div className="text-xs text-primary font-medium flex items-center gap-1">
                              View Details
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        </div>

                        {/* Delete button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteProperty(prop.id);
                          }}
                          className="absolute bottom-3 right-3 p-2 rounded-md text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all duration-300 cursor-pointer group/delete"
                          aria-label="Delete property"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </Card>
                      );
                    })}
                  </div>
                )}
              </div>

              <Separator />

              {/* Assign Properties to User */}
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Assign Property to User
                </h3>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="assign-property">Property</Label>
                      <select
                        id="assign-property"
                        value={selectedPropertyId}
                        onChange={(e) => setSelectedPropertyId(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                      >
                        <option value="">Select property...</option>
                        {properties.map((prop) => (
                          <option key={prop.id} value={prop.id}>{prop.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="assign-user">User</Label>
                      <select
                        id="assign-user"
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                      >
                        <option value="">Select user...</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.email} - {user.first_name} {user.last_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <Button onClick={assignProperty} className="cursor-pointer">Assign Property</Button>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Bookings Section */}
          <CollapsibleSection
            title="Bookings"
            description="Manage reservations and bookings"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
          >
            <div className="space-y-6">
              {/* Add Booking */}
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Booking
                </h3>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <Label htmlFor="booking-property">Property</Label>
                      <select
                        id="booking-property"
                        value={bookingPropertyId}
                        onChange={(e) => setBookingPropertyId(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                      >
                        <option value="">Select property...</option>
                        {properties.map((prop) => (
                          <option key={prop.id} value={prop.id}>{prop.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="booking-checkin">Check-in</Label>
                      <Input
                        id="booking-checkin"
                        type="date"
                        value={bookingCheckIn}
                        onChange={(e) => setBookingCheckIn(e.target.value)}
                        className="cursor-pointer"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="booking-checkout">Check-out</Label>
                      <Input
                        id="booking-checkout"
                        type="date"
                        value={bookingCheckOut}
                        onChange={(e) => setBookingCheckOut(e.target.value)}
                        className="cursor-pointer"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="booking-status">Status</Label>
                      <select
                        id="booking-status"
                        value={bookingStatus}
                        onChange={(e) => setBookingStatus(e.target.value as any)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                      >
                        <option value="upcoming">Upcoming</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                  <Button onClick={addBooking} disabled={busyBooking} className="cursor-pointer">
                    {busyBooking ? 'Adding…' : 'Add Booking'}
                  </Button>
                </div>
              </div>

              <Separator />

              {/* All Bookings */}
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  All Bookings
                </h3>
                {bookings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No bookings yet.</p>
                ) : (
                  <div className="space-y-3">
                    {properties.map((prop) => {
                      const propBookings = bookings.filter(b => b.property_id === prop.id);
                      if (propBookings.length === 0) return null;
                      return (
                        <div key={prop.id} className="space-y-2">
                          <h4 className="text-sm font-medium text-muted-foreground">{prop.name}</h4>
                          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                            {propBookings.map((booking) => (
                              <Card key={booking.id} className="p-3 border-border/50 bg-card/80 backdrop-blur-sm">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(booking.check_in).toLocaleDateString()} - {new Date(booking.check_out).toLocaleDateString()}
                                    </span>
                                    <Badge
                                      variant={booking.status === 'completed' ? 'default' : booking.status === 'upcoming' ? 'secondary' : 'outline'}
                                      className={
                                        booking.status === 'completed' ? 'bg-primary/20 text-primary border-primary' :
                                        booking.status === 'cancelled' ? 'bg-red-500/20 text-red-600 border-red-500' :
                                        ''
                                      }
                                    >
                                      {booking.status}
                                    </Badge>
                                  </div>
                                  <select
                                    value={booking.status}
                                    onChange={(e) => updateBookingStatus(booking.id, e.target.value as any)}
                                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                                  >
                                    <option value="upcoming">Upcoming</option>
                                    <option value="completed">Completed</option>
                                    <option value="cancelled">Cancelled</option>
                                  </select>
                                </div>
                              </Card>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </CollapsibleSection>

          {/* Invoices Section */}
          <CollapsibleSection
            title="Invoices"
            description="Generate and manage invoices"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
          >
            <div className="space-y-6">
              {/* Invoice Generation */}
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Invoice Generation
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="invoice-month">Month (YYYY-MM)</Label>
                    <Input
                      id="invoice-month"
                      type="month"
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                      className="cursor-pointer"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={generate} className="cursor-pointer">Generate Invoice</Button>
                    <Button onClick={downloadForMonth} variant="secondary" className="cursor-pointer">
                      Download PDF
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* All Invoices */}
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  All Invoices
                </h3>
                {invoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No invoices yet.</p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {invoices.map((invoice) => (
                      <Card key={invoice.id} className="p-4 border-border/50 bg-card/80 backdrop-blur-sm">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium text-sm">{invoice.invoice_number || 'Invoice'}</h4>
                              <p className="text-xs text-muted-foreground">
                                {new Date(invoice.bill_month).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                              </p>
                            </div>
                            <Badge
                              variant={invoice.status === 'paid' ? 'default' : 'outline'}
                              className={
                                invoice.status === 'paid'
                                  ? 'bg-primary/20 text-primary border-primary'
                                  : 'bg-red-500/10 text-red-600 border-red-500/50'
                              }
                            >
                              {invoice.status === 'paid' ? 'Paid' : 'Due'}
                            </Badge>
                          </div>
                          <p className="text-sm font-semibold">
                            ${(invoice.amount_due_cents / 100).toFixed(2)}
                          </p>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Record Payment */}
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  Record Payment
                </h3>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="payment-invoice-id">Invoice ID</Label>
                      <Input
                        id="payment-invoice-id"
                        placeholder="Invoice UUID..."
                        value={invoiceId}
                        onChange={(e) => setInvoiceId(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="payment-amount">Amount (cents)</Label>
                      <Input
                        id="payment-amount"
                        type="number"
                        placeholder="62700"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button onClick={pay} className="cursor-pointer">Record Payment</Button>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Revenue/Expenses Section */}
          <CollapsibleSection
            title="Revenue/Expenses"
            description="Manage financial entries and receipts"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          >
            <div className="space-y-6">
              {/* Add Revenue/Expense */}
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Revenue/Expense
                </h3>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <div className="space-y-2">
                      <Label htmlFor="ledger-property">Property</Label>
                      <select
                        id="ledger-property"
                        value={ledgerPropertyId}
                        onChange={(e) => setLedgerPropertyId(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                      >
                        <option value="">Select property...</option>
                        {properties.map((prop) => (
                          <option key={prop.id} value={prop.id}>{prop.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ledger-category">Type</Label>
                      <select
                        id="ledger-category"
                        value={ledgerCategory}
                        onChange={(e) => setLedgerCategory(e.target.value as any)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                      >
                        <option value="revenue">Revenue</option>
                        <option value="expense">Expense</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ledger-amount">Amount (cents)</Label>
                      <Input
                        id="ledger-amount"
                        type="number"
                        placeholder="10000"
                        value={ledgerAmount}
                        onChange={(e) => setLedgerAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ledger-date">Date</Label>
                      <Input
                        id="ledger-date"
                        type="date"
                        value={ledgerDate}
                        onChange={(e) => setLedgerDate(e.target.value)}
                        className="cursor-pointer"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ledger-description">Description</Label>
                      <Input
                        id="ledger-description"
                        placeholder="Payment received"
                        value={ledgerDescription}
                        onChange={(e) => setLedgerDescription(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button onClick={addLedgerEntry} disabled={busyLedger} className="cursor-pointer">
                    {busyLedger ? 'Adding…' : `Add ${ledgerCategory === 'revenue' ? 'Revenue' : 'Expense'}`}
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Receipt Management */}
              <div>
                <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Upload Receipt
                </h3>

                <Card className="border-border/50 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-sm">
                  <div className="p-6 space-y-5">
                    {/* Property Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="receipt-property" className="text-sm font-medium flex items-center gap-2">
                        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        Select Property
                      </Label>
                      <select
                        id="receipt-property"
                        value={receiptPropertyId}
                        onChange={(e) => setReceiptPropertyId(e.target.value)}
                        className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 cursor-pointer"
                      >
                        <option value="">Choose a property...</option>
                        {properties.map((prop) => (
                          <option key={prop.id} value={prop.id}>{prop.name}</option>
                        ))}
                      </select>
                    </div>

                    <Separator />

                    {/* File Upload Area */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Receipt File
                      </Label>
                      <label
                        htmlFor="receipt-file"
                        className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-border rounded-lg cursor-pointer bg-muted/20 hover:bg-muted/40 hover:border-primary/50 transition-all group"
                      >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          {receiptFile ? (
                            <>
                              <svg className="w-12 h-12 mb-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <p className="mb-2 text-sm font-medium text-foreground">{receiptFile.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {(receiptFile.size / 1024).toFixed(2)} KB • Click to change
                              </p>
                            </>
                          ) : (
                            <>
                              <svg
                                className="w-12 h-12 mb-3 text-muted-foreground group-hover:text-primary transition-colors"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                              <p className="mb-2 text-sm font-medium text-foreground">
                                <span className="text-primary">Click to upload</span> or drag and drop
                              </p>
                              <p className="text-xs text-muted-foreground">
                                PNG, JPG, GIF or PDF (MAX. 10MB)
                              </p>
                            </>
                          )}
                        </div>
                        <Input
                          id="receipt-file"
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {/* Upload Button */}
                    <Button
                      onClick={uploadReceipt}
                      disabled={busyReceipt || !receiptPropertyId || !receiptFile}
                      className="w-full h-11 cursor-pointer"
                      size="lg"
                    >
                      {busyReceipt ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Uploading Receipt...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          Upload Receipt
                        </>
                      )}
                    </Button>

                    {/* Info Message */}
                    <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                      <svg className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-xs text-muted-foreground">
                        Uploaded receipts will be associated with the selected property and visible in the member's portal.
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </CollapsibleSection>

        </div>
      </div>

      {/* User Profile Modal */}
      <Dialog open={showUserModal} onOpenChange={setShowUserModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedUser && (
            <>
              {/* Header with gradient background */}
              <div className="relative -m-6 mb-6 p-8 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/20 to-transparent rounded-full -mr-32 -mt-32"></div>

                <div className="relative flex items-start gap-6">
                  <div className="relative">
                    <Avatar className="w-24 h-24 border-4 border-primary/20 shadow-2xl shadow-primary/30">
                      <AvatarImage src={selectedUser.avatar_url || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground text-3xl font-bold">
                        {selectedUser.first_name?.[0]}{selectedUser.last_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-primary rounded-full border-4 border-background"></div>
                  </div>

                  <div className="flex-1">
                    <DialogTitle className="text-2xl font-bold mb-2">
                      {selectedUser.first_name} {selectedUser.last_name}
                    </DialogTitle>
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm text-muted-foreground">{selectedUser.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-medium">
                        <svg className="w-3 h-3 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {selectedUser.role.charAt(0).toUpperCase() + selectedUser.role.slice(1)}
                      </Badge>
                      {selectedUser.plan_tier && (
                        <Badge className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground border-0 font-medium">
                          <svg className="w-3 h-3 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                          </svg>
                          {TIER_LABEL[selectedUser.plan_tier as Tier]}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Content sections */}
              <div className="space-y-6 px-6 pb-6">
                {/* Plan Details & Management Card */}
                <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <h3 className="font-semibold">Subscription Plan</h3>
                    </div>

                    {selectedUser.plan_tier ? (
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Current Plan</p>
                          <p className="text-lg font-bold text-foreground">{TIER_LABEL[selectedUser.plan_tier as Tier]}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Commission Rate</p>
                          <p className="text-lg font-bold text-foreground">
                            {selectedUser.plan_tier === 'launch' ? '12%' : selectedUser.plan_tier === 'elevate' ? '18%' : '22%'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="mb-4 p-3 bg-muted/30 rounded-lg border border-dashed">
                        <p className="text-sm text-foreground">No plan assigned yet</p>
                      </div>
                    )}

                    <Separator className="my-4" />

                    {/* Update Plan Form */}
                    <div>
                      <p className="text-sm font-medium mb-3">Change Plan</p>
                      <div className="flex gap-3">
                        <select
                          value={selectedPlanTier}
                          onChange={(e) => setSelectedPlanTier(e.target.value as Tier)}
                          className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                        >
                          <option value="">Select plan...</option>
                          <option value="launch">{TIER_LABEL.launch}</option>
                          <option value="elevate">{TIER_LABEL.elevate}</option>
                          <option value="maximize">{TIER_LABEL.maximize}</option>
                        </select>
                        <Button
                          onClick={updateUserPlan}
                          disabled={updatingPlan || !selectedPlanTier || selectedPlanTier === selectedUser.plan_tier}
                          size="sm"
                          className="cursor-pointer"
                        >
                          {updatingPlan ? 'Updating...' : 'Update Plan'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Properties Section */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <h3 className="font-semibold">Assigned Properties</h3>
                    {selectedUser.properties && selectedUser.properties.length > 0 && (
                      <Badge variant="secondary" className="ml-auto">{selectedUser.properties.length}</Badge>
                    )}
                  </div>
                  {selectedUser.properties && selectedUser.properties.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {selectedUser.properties.map((prop: any) => (
                        <Card key={prop.id} className="p-4 bg-muted/30 border-muted hover:border-primary/30 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{prop.name}</p>
                              {prop.address && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">{prop.address}</p>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card className="p-6 bg-muted/20 border-dashed">
                      <div className="text-center">
                        <svg className="w-12 h-12 text-muted-foreground/50 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <p className="text-sm text-muted-foreground">No properties assigned yet</p>
                      </div>
                    </Card>
                  )}
                </div>

                {/* Invoices Section */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="font-semibold">Recent Invoices</h3>
                    {selectedUser.invoices && selectedUser.invoices.length > 0 && (
                      <Badge variant="secondary" className="ml-auto">{selectedUser.invoices.length}</Badge>
                    )}
                  </div>
                  {selectedUser.invoices && selectedUser.invoices.length > 0 ? (
                    <div className="space-y-2">
                      {selectedUser.invoices.slice(0, 5).map((invoice: any) => (
                        <Card key={invoice.id} className="p-4 bg-muted/30 border-muted hover:border-primary/30 transition-colors">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">{invoice.invoice_number || 'Invoice'}</p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(invoice.bill_month).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <p className="text-base font-semibold">${(invoice.amount_due_cents / 100).toFixed(2)}</p>
                              <Badge
                                variant={invoice.status === 'paid' ? 'default' : 'outline'}
                                className={
                                  invoice.status === 'paid'
                                    ? 'bg-primary/20 text-primary border-primary'
                                    : 'bg-red-500/10 text-red-600 border-red-500/50'
                                }
                              >
                                {invoice.status === 'paid' ? 'Paid' : 'Due'}
                              </Badge>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card className="p-6 bg-muted/20 border-dashed">
                      <div className="text-center">
                        <svg className="w-12 h-12 text-muted-foreground/50 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-sm text-muted-foreground">No invoices yet</p>
                      </div>
                    </Card>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Property Details Modal */}
      <Dialog open={showPropertyModal} onOpenChange={setShowPropertyModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedProperty && (
            <>
              {/* Header */}
              <div className="relative -m-6 mb-6 p-8 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/20 to-transparent rounded-full -mr-32 -mt-32"></div>

                <div className="relative">
                  <DialogTitle className="text-2xl font-bold mb-2 flex items-center gap-2">
                    <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    {selectedProperty.name}
                  </DialogTitle>
                  <div className="space-y-2">
                    {selectedProperty.address && (
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-sm text-muted-foreground">{selectedProperty.address}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedProperty.property_type && (
                        <Badge variant="secondary" className="font-medium">
                          {selectedProperty.property_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </Badge>
                      )}
                      {selectedProperty.airbnb_link && (
                        <a
                          href={selectedProperty.airbnb_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          View on Airbnb
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Month Selector */}
              <div className="px-6 mb-4">
                <div className="flex items-center gap-3">
                  <Label htmlFor="property-month" className="text-sm font-medium">Month</Label>
                  <Input
                    id="property-month"
                    type="month"
                    value={propertyMonth}
                    onChange={async (e) => {
                      setPropertyMonth(e.target.value);
                      // Re-fetch KPIs for new month
                      try {
                        const res = await fetch(`/api/orgs/${orgId}/properties/${selectedProperty.id}/kpis?month=${e.target.value}`);
                        const data = await res.json();
                        if (res.ok) {
                          setPropertyKpis(data.kpis || null);
                        }
                      } catch (err) {
                        console.error('Failed to fetch KPIs:', err);
                      }
                    }}
                    className="w-48 cursor-pointer"
                  />
                </div>
              </div>

              {/* KPI Metrics */}
              <div className="px-6 pb-6">
                {propertyKpis ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {/* Gross Revenue */}
                    <Card className="p-4 bg-gradient-to-br from-green-50 to-transparent border-green-200">
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-2xl">💰</div>
                        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">Gross Revenue</p>
                      <p className="text-2xl font-bold text-green-700">
                        ${((propertyKpis.gross_revenue_cents || 0) / 100).toFixed(2)}
                      </p>
                    </Card>

                    {/* Expenses */}
                    <Card className="p-4 bg-gradient-to-br from-red-50 to-transparent border-red-200">
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-2xl">💸</div>
                        <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                        </svg>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">Expenses</p>
                      <p className="text-2xl font-bold text-red-700">
                        ${((propertyKpis.expenses_cents || 0) / 100).toFixed(2)}
                      </p>
                    </Card>

                    {/* Net Revenue */}
                    <Card className="p-4 bg-gradient-to-br from-blue-50 to-transparent border-blue-200">
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-2xl">📈</div>
                        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">Net Revenue</p>
                      <p className="text-2xl font-bold text-blue-700">
                        ${(((propertyKpis.gross_revenue_cents || 0) - (propertyKpis.expenses_cents || 0)) / 100).toFixed(2)}
                      </p>
                    </Card>

                    {/* Nights Booked */}
                    <Card className="p-4 bg-gradient-to-br from-cyan-50 to-transparent border-cyan-200">
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-2xl">🏠</div>
                        <svg className="w-5 h-5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">Nights Booked</p>
                      <p className="text-2xl font-bold text-cyan-700">
                        {propertyKpis.nights_booked || 0}
                      </p>
                    </Card>

                    {/* Occupancy Rate */}
                    <Card className="p-4 bg-gradient-to-br from-purple-50 to-transparent border-purple-200">
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-2xl">📊</div>
                        <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">Occupancy Rate</p>
                      <p className="text-2xl font-bold text-purple-700">
                        {((propertyKpis.occupancy_rate || 0) * 100).toFixed(1)}%
                      </p>
                    </Card>

                    {/* Vacancy Rate */}
                    <Card className="p-4 bg-gradient-to-br from-orange-50 to-transparent border-orange-200">
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-2xl">📉</div>
                        <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                        </svg>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">Vacancy Rate</p>
                      <p className="text-2xl font-bold text-orange-700">
                        {((propertyKpis.vacancy_rate || 0) * 100).toFixed(1)}%
                      </p>
                    </Card>

                    {/* TruHost Fees */}
                    <Card className="p-4 bg-gradient-to-br from-slate-50 to-transparent border-slate-200">
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-2xl">🏢</div>
                        <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">TruHost Fees</p>
                      <p className="text-2xl font-bold text-slate-700">
                        ${(((propertyKpis.gross_revenue_cents || 0) * (propertyKpis.fee_percent || 12)) / 10000).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        ({propertyKpis.fee_percent || 12}%)
                      </p>
                    </Card>

                    {/* Properties Count (if aggregate) */}
                    {propertyKpis.properties && (
                      <Card className="p-4 bg-gradient-to-br from-indigo-50 to-transparent border-indigo-200">
                        <div className="flex items-start justify-between mb-2">
                          <div className="text-2xl">🏘️</div>
                          <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">Properties</p>
                        <p className="text-2xl font-bold text-indigo-700">
                          {propertyKpis.properties}
                        </p>
                      </Card>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="text-sm text-muted-foreground">
                      No performance data available for {propertyMonth}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
