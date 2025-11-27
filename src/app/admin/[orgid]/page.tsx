'use client';

import { useEffect, useState, Fragment } from 'react';
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
import { Listbox, Transition } from '@headlessui/react';
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
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  // --- Generate state ---
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  // --- Payments state ---
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('0');
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentPropertyFilter, setPaymentPropertyFilter] = useState<string>('all');
  const [paymentDateFilter, setPaymentDateFilter] = useState<string>('all');

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
  const [isAllPropertiesExpanded, setIsAllPropertiesExpanded] = useState(true);
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string>('all');
  const [expandedPropertyTypes, setExpandedPropertyTypes] = useState<Set<string>>(new Set());

  // --- Assign Property state ---
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [isAllUsersExpanded, setIsAllUsersExpanded] = useState(true);
  const [userPlanFilter, setUserPlanFilter] = useState<string>('all');

  // --- Booking state ---
  const [bookingPropertyId, setBookingPropertyId] = useState('');
  const [bookingCheckIn, setBookingCheckIn] = useState('');
  const [bookingCheckOut, setBookingCheckOut] = useState('');
  const [bookingStatus, setBookingStatus] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');
  const [bookings, setBookings] = useState<any[]>([]);
  const [busyBooking, setBusyBooking] = useState(false);

  // --- Booking filters ---
  const [bookingFilterProperty, setBookingFilterProperty] = useState<string>('all');
  const [bookingFilterStatus, setBookingFilterStatus] = useState<string>('all');

  // --- Invoice generation ---
  const [invoicePropertyId, setInvoicePropertyId] = useState<string>('');
  const [bookingFilterMonth, setBookingFilterMonth] = useState<string>('all');
  const [bookingSortBy, setBookingSortBy] = useState<'date-asc' | 'date-desc' | 'property'>('date-desc');
  const [isAllBookingsExpanded, setIsAllBookingsExpanded] = useState(true);
  const [expandedBookingProperties, setExpandedBookingProperties] = useState<Set<string>>(new Set());

  // --- Invoice list state ---
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoiceFilterMonth, setInvoiceFilterMonth] = useState<string>('all');
  const [invoiceFilterProperty, setInvoiceFilterProperty] = useState<string>('all');
  const [invoiceGroupBy, setInvoiceGroupBy] = useState<'month' | 'property'>('month');
  const [isAllInvoicesExpanded, setIsAllInvoicesExpanded] = useState(true);
  const [expandedInvoiceGroups, setExpandedInvoiceGroups] = useState<Set<string>>(new Set());

  // --- Revenue/Expense state ---
  const [ledgerPropertyId, setLedgerPropertyId] = useState('');
  const [ledgerAmount, setLedgerAmount] = useState('');
  const [ledgerDescription, setLedgerDescription] = useState('');
  const [ledgerDate, setLedgerDate] = useState(new Date().toISOString().slice(0, 10));
  const [ledgerCategory, setLedgerCategory] = useState<'revenue' | 'expense'>('revenue');
  const [busyLedger, setBusyLedger] = useState(false);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [ledgerGroupBy, setLedgerGroupBy] = useState<'month' | 'property'>('month');
  const [ledgerFilterMonth, setLedgerFilterMonth] = useState<string>('all');
  const [ledgerFilterProperty, setLedgerFilterProperty] = useState<string>('all');
  const [isAllEntriesExpanded, setIsAllEntriesExpanded] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // --- Receipt state ---
  const [receiptPropertyId, setReceiptPropertyId] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptCategory, setReceiptCategory] = useState('');
  const [receiptMonth, setReceiptMonth] = useState('');
  const [receiptNote, setReceiptNote] = useState('');
  const [busyReceipt, setBusyReceipt] = useState(false);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loadingReceipts, setLoadingReceipts] = useState(false);
  const [receiptFilterCategory, setReceiptFilterCategory] = useState('all');
  const [receiptFilterMonth, setReceiptFilterMonth] = useState('all');
  const [receiptFilterProperty, setReceiptFilterProperty] = useState('all');

  // --- Reviews state ---
  const [reviewPropertyId, setReviewPropertyId] = useState('');
  const [reviewPlatform, setReviewPlatform] = useState<'airbnb' | 'vrbo'>('airbnb');
  const [reviewRating, setReviewRating] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [reviewDate, setReviewDate] = useState(new Date().toISOString().slice(0, 10));
  const [busyReview, setBusyReview] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [reviewFilterProperty, setReviewFilterProperty] = useState<string>('all');
  const [reviewFilterPlatform, setReviewFilterPlatform] = useState<string>('all');
  const [reviewSortBy, setReviewSortBy] = useState<string>('date-desc');

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
      const body: { month: string; property_id?: string } = { month };
      if (invoicePropertyId) {
        body.property_id = invoicePropertyId;
      }

      const res = await fetch(`/api/orgs/${orgId}/invoices/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      let jUnknown: unknown = null;
      try { jUnknown = await res.json(); } catch {}
      const j = (jUnknown && typeof jUnknown === 'object') ? (jUnknown as Record<string, unknown>) : {};
      if (!res.ok) { setMsg(`Error ${res.status}: ${(j['error'] as string) || 'Failed to generate'}`); return; }
      const inv = j['invoice'] as { id?: string } | undefined;
      const propertyName = invoicePropertyId ? properties.find(p => p.id === invoicePropertyId)?.name : 'all properties';
      setMsg(`✓ Generated invoice for ${propertyName}: ${inv?.id || '(no id)'}`);
      await fetchInvoices();
    } catch (e) { setMsg(`Network error: ${(e as Error).message}`); }
  }

  async function downloadForMonth() {
    if (!orgId) { setMsg('Missing org id in the URL: visit /admin/<ORG_ID>'); return; }
    setMsg('Preparing PDF…');
    try {
      const body: { month: string; property_id?: string } = { month };
      if (invoicePropertyId) {
        body.property_id = invoicePropertyId;
      }

      const genRes = await fetch(`/api/orgs/${orgId}/invoices/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  async function fetchPayments() {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/orgs/${orgId}/payments/list`);
      const j = await res.json();
      if (res.ok) setPayments(j.payments || []);
    } catch (e) {
      console.error('Failed to fetch payments:', e);
    }
  }

  async function pay() {
    if (!invoiceId) { setMsg('Enter invoice id'); return; }
    const amtDollars = parseFloat(amount);
    if (!Number.isFinite(amtDollars) || amtDollars <= 0) { setMsg('Enter amount > 0'); return; }
    // Convert dollars to cents
    const amtCents = Math.round(amtDollars * 100);
    setMsg('Posting payment…');
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_cents: amtCents, method: 'bank' }),
      });
      const j = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) { setMsg(`Error ${res.status}: ${(j['error'] as string) || 'Failed to record payment'}`); return; }
      setMsg(`✓ Payment recorded. Status: ${(j['invoice'] as Record<string, unknown> | undefined)?.['status'] as string}`);
      // Refresh payments list and invoices
      await fetchPayments();
      await fetchInvoices();
      // Clear form
      setInvoiceId('');
      setAmount('0');
    } catch (e) { setMsg(`Network error: ${(e as Error).message}`); }
  }

  async function deleteInvoice(invoiceIdToDelete: string) {
    if (!confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
      return;
    }
    try {
      const res = await fetch(`/api/invoices/${invoiceIdToDelete}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`Error deleting invoice: ${data.error || 'Unknown error'}`);
        return;
      }
      setMsg(`✓ Invoice deleted successfully`);
      await fetchInvoices();
    } catch (e) {
      alert(`Error deleting invoice: ${(e as Error).message}`);
    }
  }

  async function deletePayment(paymentId: string) {
    if (!confirm('Are you sure you want to delete this payment receipt? This action cannot be undone.')) {
      return;
    }
    try {
      const res = await fetch(`/api/payments/${paymentId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`Error deleting payment: ${data.error || 'Unknown error'}`);
        return;
      }
      setMsg(`✓ Payment deleted successfully`);
      await fetchPayments();
      await fetchInvoices(); // Refresh invoices as status may change back to 'due'
    } catch (e) {
      alert(`Error deleting payment: ${(e as Error).message}`);
    }
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
      fetchLedgerEntries();
      fetchReceipts();
      fetchReviews();
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

  // Lock/unlock body scroll when modals are open
  useEffect(() => {
    if (showUserModal || showPropertyModal) {
      // Get scrollbar width before hiding it
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

      // Prevent body scroll and hide scrollbar
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    } else {
      // Restore body scroll and remove padding
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }

    // Cleanup: ensure scroll is restored when component unmounts
    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, [showUserModal, showPropertyModal]);

  async function fetchProperties() {
    try {
      const res = await fetch(`/api/orgs/${orgId}/properties/list`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      const j = await res.json();
      console.log('Fetched properties:', j.properties);
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
      // Fetch invoices for the entire year to ensure we see all generated invoices
      const currentYear = new Date().getFullYear();
      const res = await fetch(`/api/orgs/${orgId}/invoices/list?from=${currentYear}-01&to=${currentYear}-12`);
      const j = await res.json();
      if (res.ok) setInvoices(j.invoices || []);
    } catch (e) {
      console.error('Failed to fetch invoices:', e);
    }
  }

  async function fetchLedgerEntries() {
    try {
      const res = await fetch(`/api/orgs/${orgId}/ledger?admin=true`);
      const j = await res.json();
      console.log('Fetched ledger entries:', j);
      if (res.ok) {
        setLedgerEntries(j.entries || []);
        console.log('Set ledger entries state:', j.entries || []);
      }
    } catch (e) {
      console.error('Failed to fetch ledger entries:', e);
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

  async function deleteUser(userId: string) {
    if (!confirm('Are you sure you want to delete this user? This will remove them from the organization.')) return;
    try {
      const res = await fetch(`/api/orgs/${orgId}/users`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      const j = await res.json();
      if (res.ok) {
        setMsg('✓ User removed from organization');
        fetchUsers();
      } else {
        setMsg(`Error: ${j.error || 'Failed to delete user'}`);
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
        // Refresh properties list to show updated assignment
        fetchProperties();
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

  async function deleteBooking(bookingId: string) {
    if (!confirm('Are you sure you want to delete this booking? This action cannot be undone.')) return;

    try {
      const res = await fetch(`/api/orgs/${orgId}/bookings`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId }),
      });
      if (res.ok) {
        setMsg('✓ Booking deleted successfully');
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
    // Convert dollars to cents
    const amountDollars = parseFloat(ledgerAmount);
    if (!Number.isFinite(amountDollars) || amountDollars < 0) {
      setMsg('Amount must be a valid positive number');
      return;
    }
    const amountCents = Math.round(amountDollars * 100);
    setBusyLedger(true); setMsg('Adding entry…');
    try {
      const res = await fetch(`/api/orgs/${orgId}/ledger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: ledgerPropertyId,
          amount_cents: amountCents,
          description: ledgerDescription,
          entry_date: ledgerDate,
          kind: ledgerCategory,
          category: ledgerCategory,
        }),
      });
      const j = await res.json();
      if (res.ok) {
        setMsg(`✓ ${ledgerCategory === 'revenue' ? 'Revenue' : 'Expense'} added`);
        setLedgerPropertyId('');
        setLedgerAmount('');
        setLedgerDescription('');
        fetchLedgerEntries();
      } else {
        setMsg(`Error: ${j.error || 'Failed to add entry'}`);
      }
    } catch (e) {
      setMsg(`Network error: ${(e as Error).message}`);
    } finally {
      setBusyLedger(false);
    }
  }

  async function deleteLedgerEntry(entryId: string) {
    if (!confirm('Are you sure you want to delete this entry? This will update the KPIs.')) return;
    try {
      const res = await fetch(`/api/orgs/${orgId}/ledger`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id: entryId }),
      });
      const j = await res.json();
      if (res.ok) {
        setMsg('✓ Entry deleted successfully');
        fetchLedgerEntries();
      } else {
        setMsg(`Error: ${j.error || 'Failed to delete entry'}`);
      }
    } catch (e) {
      setMsg(`Network error: ${(e as Error).message}`);
    }
  }

  // --- Receipt actions ---
  async function fetchReceipts() {
    setLoadingReceipts(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/receipts`);
      const j = await res.json();
      if (j.ok) {
        setReceipts(j.receipts || []);
      }
    } catch (e) {
      console.error('Error fetching receipts:', e);
    } finally {
      setLoadingReceipts(false);
    }
  }

  async function uploadReceipt() {
    if (!receiptPropertyId || !receiptFile) {
      setMsg('Please select a property and a file');
      return;
    }
    if (!receiptCategory) {
      setMsg('Please select a category');
      return;
    }
    if (!receiptMonth) {
      setMsg('Please select a month');
      return;
    }
    setBusyReceipt(true); setMsg('Uploading receipt…');
    try {
      const formData = new FormData();
      formData.append('file', receiptFile);
      formData.append('propertyId', receiptPropertyId);
      formData.append('description', receiptCategory);
      formData.append('receiptDate', `${receiptMonth}-01`); // Use first day of the month
      if (receiptNote) {
        formData.append('note', receiptNote);
      }

      const res = await fetch(`/api/orgs/${orgId}/receipts/upload`, {
        method: 'POST',
        body: formData,
      });
      const j = await res.json();
      if (res.ok) {
        setMsg('✓ Receipt uploaded');
        setReceiptPropertyId('');
        setReceiptFile(null);
        setReceiptCategory('');
        setReceiptMonth('');
        setReceiptNote('');
        fetchReceipts(); // Refresh receipts list
      } else {
        setMsg(`Error: ${j.error || 'Failed to upload receipt'}`);
      }
    } catch (e) {
      setMsg(`Network error: ${(e as Error).message}`);
    } finally {
      setBusyReceipt(false);
    }
  }

  async function deleteReceipt(receiptId: string) {
    if (!confirm('Delete this receipt?')) return;

    try {
      const res = await fetch(`/api/orgs/${orgId}/receipts?receiptId=${receiptId}`, {
        method: 'DELETE',
      });
      const j = await res.json();
      if (j.ok) {
        setMsg('✓ Receipt deleted');
        fetchReceipts(); // Refresh receipts list
      } else {
        setMsg(`Error: ${j.error || 'Failed to delete receipt'}`);
      }
    } catch (e) {
      setMsg(`Network error: ${(e as Error).message}`);
    }
  }

  // --- Review actions ---
  async function fetchReviews() {
    setLoadingReviews(true);
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return;

      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`/api/orgs/${orgId}/reviews`, { headers });
      const j = await res.json();
      if (j.ok) {
        setReviews(j.reviews || []);
      }
    } catch (e) {
      console.error('Error fetching reviews:', e);
    } finally {
      setLoadingReviews(false);
    }
  }

  async function addReview() {
    if (!reviewPropertyId || !reviewRating || !reviewDate) {
      setMsg('Please fill in property, rating, and date');
      return;
    }

    const rating = parseFloat(reviewRating);
    const maxRating = reviewPlatform === 'airbnb' ? 5 : 10;

    if (isNaN(rating) || rating < 0 || rating > maxRating) {
      setMsg(`Rating must be between 0 and ${maxRating} for ${reviewPlatform}`);
      return;
    }

    setBusyReview(true);
    setMsg('Adding review...');

    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) {
        setMsg('Not authenticated');
        return;
      }

      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`/api/orgs/${orgId}/reviews`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          property_id: reviewPropertyId,
          platform: reviewPlatform,
          rating,
          review_text: reviewText || null,
          review_date: reviewDate,
        }),
      });

      const j = await res.json();
      if (res.ok) {
        setMsg('✓ Review added successfully');
        setReviewPropertyId('');
        setReviewRating('');
        setReviewText('');
        setReviewDate(new Date().toISOString().slice(0, 10));
        fetchReviews();
      } else {
        setMsg(`Error: ${j.error || 'Failed to add review'}`);
      }
    } catch (e) {
      setMsg(`Network error: ${(e as Error).message}`);
    } finally {
      setBusyReview(false);
    }
  }

  async function deleteReview(reviewId: string) {
    if (!confirm('Are you sure you want to delete this review?')) return;

    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) {
        setMsg('Not authenticated');
        return;
      }

      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`/api/orgs/${orgId}/reviews?id=${reviewId}`, {
        method: 'DELETE',
        headers,
      });

      const j = await res.json();
      if (j.ok) {
        setMsg('✓ Review deleted');
        fetchReviews(); // Refresh reviews list
      } else {
        setMsg(`Error: ${j.error || 'Failed to delete review'}`);
      }
    } catch (e) {
      setMsg(`Network error: ${(e as Error).message}`);
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

  // Fetch unread messages count
  const fetchUnreadMessages = async () => {
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!user || !orgId) return;

      const { data: { session } } = await sb.auth.getSession();
      if (!session) return;

      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/orgs/${orgId}/messages/unread`, { headers });
      const data = await response.json();

      if (data.ok) {
        setUnreadMessagesCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error fetching unread messages:', error);
    }
  };

  // Fetch unread messages on mount
  useEffect(() => {
    if (orgId) {
      fetchUnreadMessages();
      // Poll for new messages every 30 seconds
      const interval = setInterval(fetchUnreadMessages, 30000);
      return () => clearInterval(interval);
    }
  }, [orgId]);

  // Function to get icon based on property type
  const getPropertyIcon = (type: string) => {
    switch(type) {
      case 'house':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        );
      case 'apartment':
      case 'condo':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        );
      case 'villa':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
          </svg>
        );
      case 'cabin':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h18M4 18h16M6 6l6-3 6 3M6 6v12M18 6v12M9 10h6v8H9v-8z" />
          </svg>
        );
      case 'basement_suite':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7M19 21V9m0 12h2m-2 0h-5m-9 0H3m2 0h5" />
          </svg>
        );
      case 'garden_suite':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        );
      case 'carriage_house':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F6F2] via-[#E1ECDB]/30 to-[#9db896]/20 relative overflow-x-hidden">

      {/* Header */}
      <div className="bg-white border-b border-border shadow-sm relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1 sm:py-2">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4">
              {/* TruHost Logo */}
              <Image
                src="/truhost-logo.png"
                alt="TruHost Logo"
                width={380}
                height={106}
                className="h-14 sm:h-24 md:h-32 w-auto object-contain transition-transform hover:scale-105"
                priority
              />
              <div className="hidden sm:flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Admin Portal</p>
                {/* Pulsing green dot */}
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-2 h-2 rounded-full animate-ping opacity-75" style={{ backgroundColor: '#6b9b7a' }}></div>
                  <div className="relative w-2 h-2 rounded-full" style={{ backgroundColor: '#6b9b7a' }}></div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-3">
              {/* Portal Button - Switch to member portal view */}
              <Button
                onClick={() => router.push(`/portal/${orgId}`)}
                variant="outline"
                size="sm"
                className="border-border hover:bg-primary/5 hover:border-primary hover:scale-105 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 cursor-pointer text-xs sm:text-sm"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="sm:mr-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="hidden sm:inline">Portal</span>
              </Button>
              {/* Messages Button */}
              <Button
                onClick={() => router.push(`/admin/${orgId}/messages`)}
                variant="outline"
                size="sm"
                className="border-border hover:bg-primary/5 hover:border-primary transition-all duration-300 cursor-pointer relative text-xs sm:text-sm"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="sm:mr-2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span className="hidden sm:inline">Messages</span>
                {unreadMessagesCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                    {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                  </span>
                )}
              </Button>
              {/* Logout Button */}
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="border-border hover:border-destructive hover:text-destructive hover:bg-destructive/5 transition-all duration-300 cursor-pointer text-xs sm:text-sm"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="sm:mr-2">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
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
                    <Listbox value={inviteRole} onChange={(val) => setInviteRole(val as Role)}>
                      <div className="relative">
                        <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-background py-2.5 pl-3 pr-10 text-left border border-input hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all">
                          <span className="block truncate text-sm">
                            {inviteRole === 'member' ? 'Member' : inviteRole === 'manager' ? 'Manager' : 'Owner'}
                          </span>
                          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                            <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                            </svg>
                          </span>
                        </Listbox.Button>
                        <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                          <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar">
                            {['member', 'manager', 'owner'].map((role) => (
                              <Listbox.Option
                                key={role}
                                value={role}
                                className={({ active }) =>
                                  `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`
                                }
                              >
                                {({ selected }) => (
                                  <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                    {role === 'member' ? 'Member' : role === 'manager' ? 'Manager' : 'Owner'}
                                  </span>
                                )}
                              </Listbox.Option>
                            ))}
                          </Listbox.Options>
                        </Transition>
                      </div>
                    </Listbox>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-plan">Plan Tier</Label>
                    <Listbox value={invitePlan} onChange={(val) => setInvitePlan(val as Tier)}>
                      <div className="relative">
                        <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-background py-2.5 pl-3 pr-10 text-left border border-input hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all">
                          <span className="block truncate text-sm">{TIER_LABEL[invitePlan]}</span>
                          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                            <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                            </svg>
                          </span>
                        </Listbox.Button>
                        <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                          <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar">
                            {(['launch', 'elevate', 'maximize'] as Tier[]).map((tier) => (
                              <Listbox.Option
                                key={tier}
                                value={tier}
                                className={({ active }) =>
                                  `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`
                                }
                              >
                                {({ selected }) => (
                                  <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                    {TIER_LABEL[tier]}
                                  </span>
                                )}
                              </Listbox.Option>
                            ))}
                          </Listbox.Options>
                        </Transition>
                      </div>
                    </Listbox>
                  </div>
                </div>
                <Button onClick={invite} disabled={busyInvite} className="mt-4 cursor-pointer">
                  {busyInvite ? 'Inviting…' : 'Send Invitation'}
                </Button>
              </div>

              <Separator />

              {/* Users */}
              <div>
                <button
                  onClick={() => setIsAllUsersExpanded(!isAllUsersExpanded)}
                  className="w-full flex items-center justify-between mb-3 p-4 rounded-xl transition-all duration-500 cursor-pointer group relative overflow-hidden backdrop-blur-sm"
                  style={{
                    background: 'linear-gradient(135deg, #9db89605 0%, transparent 100%)',
                    border: '2px solid #9db89620',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #9db89615 0%, #9db89605 100%)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 16px -4px #9db89630';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #9db89605 0%, transparent 100%)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Animated shimmer overlay */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background: 'linear-gradient(90deg, #9db89600, #9db89640, #9db89600)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 3s infinite',
                      pointerEvents: 'none',
                    }}
                  />

                  <div className="flex items-center gap-3 relative z-10">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-12"
                      style={{
                        background: 'linear-gradient(135deg, #9db89620, #9db89640)',
                        boxShadow: '0 4px 12px #9db89630',
                      }}
                    >
                      <svg className="w-5 h-5 text-[#6b9b7a] transition-all duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-base font-bold">All Users</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/20 text-foreground">
                          {users.length} total
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl backdrop-blur-md transition-all duration-500 group-hover:scale-105 relative z-10"
                    style={{
                      background: 'linear-gradient(135deg, #9db89615, #9db89625)',
                      border: '1px solid #9db89640',
                      boxShadow: '0 4px 12px #9db89620',
                    }}
                  >
                    <span className="text-xs font-bold tracking-wide text-foreground">
                      {isAllUsersExpanded ? 'HIDE' : 'SHOW'}
                    </span>
                    <div className="relative w-5 h-5">
                      <svg
                        className={`absolute inset-0 transition-all duration-700 ${isAllUsersExpanded ? 'rotate-180 scale-110' : 'rotate-0'}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        style={{ color: '#9db896' }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </button>

                {/* Add shimmer keyframe animation */}
                <style jsx>{`
                  @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                  }
                `}</style>

                <div
                  className="overflow-hidden transition-all duration-700 ease-in-out"
                  style={{
                    maxHeight: isAllUsersExpanded ? '10000px' : '0px',
                    opacity: isAllUsersExpanded ? 1 : 0,
                  }}
                >
                  {/* Plan Filter */}
                  {users.length > 0 && (
                    <div className="mb-4 flex flex-wrap items-center justify-end gap-2 sm:gap-4 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Filter by Plan:</span>
                        <Listbox value={userPlanFilter} onChange={setUserPlanFilter}>
                          <div className="relative">
                            <Listbox.Button className="relative w-28 sm:w-36 cursor-pointer rounded-lg bg-background py-1.5 pl-3 pr-8 text-left text-xs border border-border hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all">
                              <span className="block truncate">
                                {userPlanFilter === 'all' ? 'All Plans' : TIER_LABEL[userPlanFilter as Tier]}
                              </span>
                              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                                </svg>
                              </span>
                            </Listbox.Button>
                            <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                              <Listbox.Options className="absolute right-0 z-50 mt-1 max-h-60 w-40 overflow-auto rounded-md bg-background py-1 text-xs shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar">
                                {[{ value: 'all', label: 'All Plans' }, { value: 'launch', label: 'Launch (12%)' }, { value: 'elevate', label: 'Elevate (18%)' }, { value: 'maximize', label: 'Maximize (22%)' }].map((opt) => (
                                  <Listbox.Option
                                    key={opt.value}
                                    value={opt.value}
                                    className={({ active }) =>
                                      `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`
                                    }
                                  >
                                    {({ selected }) => (
                                      <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                        {opt.label}
                                      </span>
                                    )}
                                  </Listbox.Option>
                                ))}
                              </Listbox.Options>
                            </Transition>
                          </div>
                        </Listbox>
                      </div>
                    </div>
                  )}

                {users.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No users yet.</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {users
                      .filter(user => userPlanFilter === 'all' || user.plan_tier === userPlanFilter)
                      .map((user) => (
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
                      <Listbox value={propertyType} onChange={setPropertyType}>
                        <div className="relative">
                          <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-background py-2.5 pl-3 pr-10 text-left border border-input hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all">
                            <span className="block truncate text-sm">
                              {propertyType ? { house: 'House', apartment: 'Apartment', condo: 'Condo', villa: 'Villa', cabin: 'Cabin', basement_suite: 'Basement Suite', garden_suite: 'Garden Suite', carriage_house: 'Carriage House', other: 'Other' }[propertyType] : 'Select type...'}
                            </span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                              </svg>
                            </span>
                          </Listbox.Button>
                          <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                            <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar">
                              {[{ value: '', label: 'Select type...' }, { value: 'house', label: 'House' }, { value: 'apartment', label: 'Apartment' }, { value: 'condo', label: 'Condo' }, { value: 'villa', label: 'Villa' }, { value: 'cabin', label: 'Cabin' }, { value: 'basement_suite', label: 'Basement Suite' }, { value: 'garden_suite', label: 'Garden Suite' }, { value: 'carriage_house', label: 'Carriage House' }, { value: 'other', label: 'Other' }].map((opt) => (
                                <Listbox.Option
                                  key={opt.value}
                                  value={opt.value}
                                  className={({ active }) =>
                                    `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`
                                  }
                                >
                                  {({ selected }) => (
                                    <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                      {opt.label}
                                    </span>
                                  )}
                                </Listbox.Option>
                              ))}
                            </Listbox.Options>
                          </Transition>
                        </div>
                      </Listbox>
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
                <button
                  onClick={() => setIsAllPropertiesExpanded(!isAllPropertiesExpanded)}
                  className="w-full flex items-center justify-between mb-3 p-4 rounded-xl transition-all duration-500 cursor-pointer group relative overflow-hidden backdrop-blur-sm"
                  style={{
                    background: 'linear-gradient(135deg, #9db89605 0%, transparent 100%)',
                    border: '2px solid #9db89620',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #9db89615 0%, #9db89605 100%)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 16px -4px #9db89630';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #9db89605 0%, transparent 100%)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background: 'linear-gradient(90deg, #9db89600, #9db89640, #9db89600)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 3s infinite',
                      pointerEvents: 'none',
                    }}
                  />
                  <div className="flex items-center gap-3 relative z-10">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-12"
                      style={{
                        background: 'linear-gradient(135deg, #9db89620, #9db89640)',
                        boxShadow: '0 4px 12px #9db89630',
                      }}
                    >
                      <svg className="w-5 h-5 text-[#6b9b7a] transition-all duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-base font-bold">All Properties</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/20 text-foreground">
                          {properties.length} total
                        </span>
                      </div>
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl backdrop-blur-md transition-all duration-500 group-hover:scale-105 relative z-10"
                    style={{
                      background: 'linear-gradient(135deg, #9db89615, #9db89625)',
                      border: '1px solid #9db89640',
                      boxShadow: '0 4px 12px #9db89620',
                    }}
                  >
                    <span className="text-xs font-bold tracking-wide text-foreground">
                      {isAllPropertiesExpanded ? 'HIDE' : 'SHOW'}
                    </span>
                    <div className="relative w-5 h-5">
                      <svg
                        className={`absolute inset-0 transition-all duration-700 ${isAllPropertiesExpanded ? 'rotate-180 scale-110' : 'rotate-0'}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        style={{ color: '#9db896' }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </button>

                <div
                  className="overflow-hidden transition-all duration-700 ease-in-out"
                  style={{
                    maxHeight: isAllPropertiesExpanded ? '10000px' : '0px',
                    opacity: isAllPropertiesExpanded ? 1 : 0,
                  }}
                >
                  {/* Filter by Property Type */}
                  {properties.length > 0 && (
                    <div className="flex flex-wrap items-center justify-end mb-3 gap-2 text-xs">
                      <span className="text-muted-foreground">Filter by Type:</span>
                      <Listbox value={propertyTypeFilter} onChange={setPropertyTypeFilter}>
                        <div className="relative">
                          <Listbox.Button className="relative w-28 sm:w-36 cursor-pointer rounded-lg bg-background py-1.5 pl-3 pr-8 text-left text-xs border border-border hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all">
                            <span className="block truncate">
                              {propertyTypeFilter === 'all' ? 'All Types' : propertyTypeFilter.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                            </span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                              </svg>
                            </span>
                          </Listbox.Button>
                          <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                            <Listbox.Options className="absolute right-0 z-50 mt-1 max-h-60 w-40 overflow-auto rounded-md bg-background py-1 text-xs shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar">
                              <Listbox.Option
                                value="all"
                                className={({ active }) =>
                                  `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`
                                }
                              >
                                {({ selected }) => (
                                  <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                    All Types
                                  </span>
                                )}
                              </Listbox.Option>
                              {(() => {
                                const types = new Set<string>();
                                properties.forEach(prop => {
                                  if (prop.property_type) types.add(prop.property_type);
                                });
                                return Array.from(types).sort().map(type => (
                                  <Listbox.Option
                                    key={type}
                                    value={type}
                                    className={({ active }) =>
                                      `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`
                                    }
                                  >
                                    {({ selected }) => (
                                      <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                        {type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                                      </span>
                                    )}
                                  </Listbox.Option>
                                ));
                              })()}
                            </Listbox.Options>
                          </Transition>
                        </div>
                      </Listbox>
                    </div>
                  )}
                  {properties.length === 0 ? (
                  <div className="text-center py-12 bg-muted/30 rounded-lg border-2 border-dashed border-border">
                    <svg className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <p className="text-sm font-medium text-muted-foreground mb-1">No properties yet</p>
                    <p className="text-xs text-muted-foreground">Add your first property using the form above</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(() => {
                      // Filter properties by selected type
                      let filteredProperties = properties;

                      if (propertyTypeFilter !== 'all') {
                        filteredProperties = filteredProperties.filter(prop => prop.property_type === propertyTypeFilter);
                      }

                      // Group properties by type
                      const grouped = filteredProperties.reduce((acc: Record<string, any[]>, prop) => {
                        const key = prop.property_type || 'no-type';
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(prop);
                        return acc;
                      }, {});

                      return Object.entries(grouped).map(([key, typeProperties]) => {
                        const typeLabel = key === 'no-type'
                          ? 'No Type'
                          : key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());

                        const isExpanded = expandedPropertyTypes.has(key);

                        const toggleType = () => {
                          const newExpanded = new Set(expandedPropertyTypes);
                          if (isExpanded) {
                            newExpanded.delete(key);
                          } else {
                            newExpanded.add(key);
                          }
                          setExpandedPropertyTypes(newExpanded);
                        };

                        return (
                          <div key={key} className="border border-border/50 rounded-lg p-4 bg-gradient-to-r from-muted/20 to-muted/10">
                            {/* Type Header */}
                            <button
                              onClick={toggleType}
                              className="w-full flex items-center justify-between mb-3 hover:bg-[#E1ECDB]/10 p-2 rounded-lg transition-colors cursor-pointer"
                            >
                              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                                {typeLabel}
                                <Badge variant="outline" className="text-xs ml-1">{typeProperties.length}</Badge>
                              </h4>
                              <svg className={`w-5 h-5 text-[#9db896] transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>

                            {/* Properties for this type */}
                            <div
                              className="overflow-hidden transition-all duration-700 ease-in-out"
                              style={{
                                maxHeight: isExpanded ? '5000px' : '0px',
                                opacity: isExpanded ? 1 : 0,
                              }}
                            >
                              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {typeProperties.map((prop, index) => (
                        <Card
                          key={prop.id}
                          className="group relative overflow-hidden cursor-pointer transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg border-border/50 bg-gradient-to-br from-card via-card to-card/80 backdrop-blur-sm"
                          style={{
                            animation: 'fadeIn 0.5s ease-out forwards',
                            animationDelay: `${index * 100}ms`,
                            opacity: 0,
                          }}
                          onClick={() => openPropertyModal(prop)}
                        >
                          {/* Decorative gradient overlay */}
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out"></div>

                          {/* Decorative corner accent */}
                          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-full -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out"></div>

                          <div className="relative p-5">
                            {/* Property Icon & Name */}
                            <div className="flex items-start gap-3 mb-3">
                              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                                {getPropertyIcon(prop.property_type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-base mb-1 truncate group-hover:text-primary transition-colors duration-200 ease-out">
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
                                <Badge variant="secondary" className="text-xs font-medium border-primary/20 bg-primary/5 text-black group-hover:border-primary/40 transition-colors duration-200 ease-out">
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
                    ))}
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
                </div>
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
                      <Listbox value={selectedPropertyId} onChange={setSelectedPropertyId}>
                        <div className="relative">
                          <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-background py-2.5 pl-3 pr-10 text-left border border-input hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all">
                            <span className="block truncate text-sm">
                              {selectedPropertyId ? properties.find(p => p.id === selectedPropertyId)?.name || 'Select property...' : 'Select property...'}
                            </span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                              </svg>
                            </span>
                          </Listbox.Button>
                          <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                            <Listbox.Options className="absolute z-50 bottom-full mb-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar">
                              <Listbox.Option value="" className={({ active }) => `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`}>
                                {({ selected }) => <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>Select property...</span>}
                              </Listbox.Option>
                              {properties.map((prop) => (
                                <Listbox.Option key={prop.id} value={prop.id} className={({ active }) => `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`}>
                                  {({ selected }) => <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>{prop.name}</span>}
                                </Listbox.Option>
                              ))}
                            </Listbox.Options>
                          </Transition>
                        </div>
                      </Listbox>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="assign-user">User</Label>
                      <Listbox value={selectedUserId} onChange={setSelectedUserId}>
                        <div className="relative">
                          <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-background py-2.5 pl-3 pr-10 text-left border border-input hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all">
                            <span className="block truncate text-sm">
                              {selectedUserId ? (() => { const u = users.find(u => u.id === selectedUserId); return u ? `${u.email} - ${u.first_name} ${u.last_name}` : 'Select user...'; })() : 'Select user...'}
                            </span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                              </svg>
                            </span>
                          </Listbox.Button>
                          <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                            <Listbox.Options className="absolute z-50 bottom-full mb-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar">
                              <Listbox.Option value="" className={({ active }) => `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`}>
                                {({ selected }) => <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>Select user...</span>}
                              </Listbox.Option>
                              {users.map((user) => (
                                <Listbox.Option key={user.id} value={user.id} className={({ active }) => `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`}>
                                  {({ selected }) => <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>{user.email} - {user.first_name} {user.last_name}</span>}
                                </Listbox.Option>
                              ))}
                            </Listbox.Options>
                          </Transition>
                        </div>
                      </Listbox>
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
                      <Listbox value={bookingPropertyId} onChange={setBookingPropertyId}>
                        <div className="relative">
                          <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-background py-2.5 pl-3 pr-10 text-left border border-input hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all">
                            <span className="block truncate text-sm">
                              {bookingPropertyId ? properties.find(p => p.id === bookingPropertyId)?.name : 'Select property...'}
                            </span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                              </svg>
                            </span>
                          </Listbox.Button>
                          <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                            <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar">
                              <Listbox.Option
                                value=""
                                className={({ active }) =>
                                  `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`
                                }
                              >
                                {({ selected }) => (
                                  <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                    Select property...
                                  </span>
                                )}
                              </Listbox.Option>
                              {properties.map((prop) => (
                                <Listbox.Option
                                  key={prop.id}
                                  value={prop.id}
                                  className={({ active }) =>
                                    `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`
                                  }
                                >
                                  {({ selected }) => (
                                    <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                      {prop.name}
                                    </span>
                                  )}
                                </Listbox.Option>
                              ))}
                            </Listbox.Options>
                          </Transition>
                        </div>
                      </Listbox>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="booking-checkin" className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-[#9db896]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Check-in
                      </Label>
                      <div className="relative">
                        <Input
                          id="booking-checkin"
                          type="date"
                          value={bookingCheckIn}
                          onChange={(e) => setBookingCheckIn(e.target.value)}
                          className="cursor-pointer pl-10 border-[#E1ECDB] focus:ring-[#9db896] focus:border-[#9db896] hover:border-[#9db896] transition-colors"
                          style={{ colorScheme: 'light' }}
                        />
                        <svg className="w-5 h-5 text-[#9db896] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="booking-checkout" className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-[#9db896]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Check-out
                      </Label>
                      <div className="relative">
                        <Input
                          id="booking-checkout"
                          type="date"
                          value={bookingCheckOut}
                          onChange={(e) => setBookingCheckOut(e.target.value)}
                          className="cursor-pointer pl-10 border-[#E1ECDB] focus:ring-[#9db896] focus:border-[#9db896] hover:border-[#9db896] transition-colors"
                          style={{ colorScheme: 'light' }}
                        />
                        <svg className="w-5 h-5 text-[#9db896] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="booking-status">Status</Label>
                      <Listbox value={bookingStatus} onChange={(val) => setBookingStatus(val as any)}>
                        <div className="relative">
                          <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-background py-2.5 pl-3 pr-10 text-left border border-input hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all">
                            <span className="block truncate text-sm">
                              {bookingStatus === 'upcoming' ? 'Upcoming' : bookingStatus === 'completed' ? 'Completed' : 'Cancelled'}
                            </span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                              </svg>
                            </span>
                          </Listbox.Button>
                          <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                            <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar">
                              {[
                                { value: 'upcoming', label: 'Upcoming' },
                                { value: 'completed', label: 'Completed' },
                                { value: 'cancelled', label: 'Cancelled' },
                              ].map((opt) => (
                                <Listbox.Option
                                  key={opt.value}
                                  value={opt.value}
                                  className={({ active }) =>
                                    `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`
                                  }
                                >
                                  {({ selected }) => (
                                    <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                      {opt.label}
                                    </span>
                                  )}
                                </Listbox.Option>
                              ))}
                            </Listbox.Options>
                          </Transition>
                        </div>
                      </Listbox>
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
                <button
                  onClick={() => setIsAllBookingsExpanded(!isAllBookingsExpanded)}
                  className="w-full flex items-center justify-between mb-3 p-4 rounded-xl transition-all duration-500 cursor-pointer group relative overflow-hidden backdrop-blur-sm"
                  style={{
                    background: 'linear-gradient(135deg, #9db89605 0%, transparent 100%)',
                    border: '2px solid #9db89620',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #9db89615 0%, #9db89605 100%)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 16px -4px #9db89630';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #9db89605 0%, transparent 100%)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background: 'linear-gradient(90deg, #9db89600, #9db89640, #9db89600)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 3s infinite',
                      pointerEvents: 'none',
                    }}
                  />
                  <div className="flex items-center gap-3 relative z-10">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-12"
                      style={{
                        background: 'linear-gradient(135deg, #9db89620, #9db89640)',
                        boxShadow: '0 4px 12px #9db89630',
                      }}
                    >
                      <svg className="w-5 h-5 text-[#6b9b7a] transition-all duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-base font-bold">All Bookings</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/20 text-foreground">
                          {bookings.length} total
                        </span>
                      </div>
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl backdrop-blur-md transition-all duration-500 group-hover:scale-105 relative z-10"
                    style={{
                      background: 'linear-gradient(135deg, #9db89615, #9db89625)',
                      border: '1px solid #9db89640',
                      boxShadow: '0 4px 12px #9db89620',
                    }}
                  >
                    <span className="text-xs font-bold tracking-wide text-foreground">
                      {isAllBookingsExpanded ? 'HIDE' : 'SHOW'}
                    </span>
                    <div className="relative w-5 h-5">
                      <svg
                        className={`absolute inset-0 transition-all duration-700 ${isAllBookingsExpanded ? 'rotate-180 scale-110' : 'rotate-0'}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        style={{ color: '#9db896' }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </button>

                <div
                  className="overflow-hidden transition-all duration-700 ease-in-out"
                  style={{
                    maxHeight: isAllBookingsExpanded ? '10000px' : '0px',
                    opacity: isAllBookingsExpanded ? 1 : 0,
                  }}
                >
                {/* Filters and Sorting */}
                {bookings.length > 0 && (
                  <div className="mb-4 p-4 rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm">
                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="filter-property" className="text-xs text-muted-foreground">
                          Filter by Property
                        </Label>
                        <Listbox value={bookingFilterProperty} onChange={setBookingFilterProperty}>
                          <div className="relative">
                            <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-background py-2 pl-3 pr-10 text-left border border-input hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all text-sm">
                              <span className="block truncate">
                                {bookingFilterProperty === 'all' ? 'All Properties' : properties.find(p => p.id === bookingFilterProperty)?.name}
                              </span>
                              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                                </svg>
                              </span>
                            </Listbox.Button>
                            <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                              <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar">
                                <Listbox.Option
                                  value="all"
                                  className={({ active }) =>
                                    `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`
                                  }
                                >
                                  {({ selected }) => (
                                    <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                      All Properties
                                    </span>
                                  )}
                                </Listbox.Option>
                                {properties.map((prop) => (
                                  <Listbox.Option
                                    key={prop.id}
                                    value={prop.id}
                                    className={({ active }) =>
                                      `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`
                                    }
                                  >
                                    {({ selected }) => (
                                      <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                        {prop.name}
                                      </span>
                                    )}
                                  </Listbox.Option>
                                ))}
                              </Listbox.Options>
                            </Transition>
                          </div>
                        </Listbox>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="filter-status" className="text-xs text-muted-foreground">
                          Filter by Status
                        </Label>
                        <Listbox value={bookingFilterStatus} onChange={setBookingFilterStatus}>
                          <div className="relative">
                            <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-background py-2 pl-3 pr-10 text-left border border-input hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all text-sm">
                              <span className="block truncate">
                                {bookingFilterStatus === 'all' ? 'All Statuses' : bookingFilterStatus.charAt(0).toUpperCase() + bookingFilterStatus.slice(1)}
                              </span>
                              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                                </svg>
                              </span>
                            </Listbox.Button>
                            <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                              <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar">
                                {[
                                  { value: 'all', label: 'All Statuses' },
                                  { value: 'upcoming', label: 'Upcoming' },
                                  { value: 'completed', label: 'Completed' },
                                  { value: 'cancelled', label: 'Cancelled' },
                                ].map((opt) => (
                                  <Listbox.Option
                                    key={opt.value}
                                    value={opt.value}
                                    className={({ active }) =>
                                      `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`
                                    }
                                  >
                                    {({ selected }) => (
                                      <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                        {opt.label}
                                      </span>
                                    )}
                                  </Listbox.Option>
                                ))}
                              </Listbox.Options>
                            </Transition>
                          </div>
                        </Listbox>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="filter-month" className="text-xs text-muted-foreground">
                          Filter by Month
                        </Label>
                        <Listbox value={bookingFilterMonth} onChange={setBookingFilterMonth}>
                          <div className="relative">
                            <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-background py-2 pl-3 pr-10 text-left border border-input hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all text-sm">
                              <span className="block truncate">
                                {bookingFilterMonth === 'all' ? 'All Months' : (() => {
                                  const [year, monthNum] = bookingFilterMonth.split('-').map(Number);
                                  return new Date(year, monthNum - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                                })()}
                              </span>
                              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                                </svg>
                              </span>
                            </Listbox.Button>
                            <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                              <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar">
                                <Listbox.Option
                                  value="all"
                                  className={({ active }) =>
                                    `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`
                                  }
                                >
                                  {({ selected }) => (
                                    <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                      All Months
                                    </span>
                                  )}
                                </Listbox.Option>
                                {Array.from(new Set(bookings.map(b => b.check_in.slice(0, 7)))).sort().reverse().map(month => (
                                  <Listbox.Option
                                    key={month}
                                    value={month}
                                    className={({ active }) =>
                                      `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`
                                    }
                                  >
                                    {({ selected }) => (
                                      <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                        {(() => {
                                          const [year, monthNum] = month.split('-').map(Number);
                                          return new Date(year, monthNum - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                                        })()}
                                      </span>
                                    )}
                                  </Listbox.Option>
                                ))}
                              </Listbox.Options>
                            </Transition>
                          </div>
                        </Listbox>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="sort-by" className="text-xs text-muted-foreground">
                          Sort By
                        </Label>
                        <Listbox value={bookingSortBy} onChange={(val) => setBookingSortBy(val as any)}>
                          <div className="relative">
                            <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-background py-2 pl-3 pr-10 text-left border border-input hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all text-sm">
                              <span className="block truncate">
                                {bookingSortBy === 'date-desc' ? 'Newest First' : bookingSortBy === 'date-asc' ? 'Oldest First' : 'By Property'}
                              </span>
                              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                                </svg>
                              </span>
                            </Listbox.Button>
                            <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                              <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar">
                                {[
                                  { value: 'date-desc', label: 'Newest First' },
                                  { value: 'date-asc', label: 'Oldest First' },
                                  { value: 'property', label: 'By Property' },
                                ].map((opt) => (
                                  <Listbox.Option
                                    key={opt.value}
                                    value={opt.value}
                                    className={({ active }) =>
                                      `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`
                                    }
                                  >
                                    {({ selected }) => (
                                      <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                        {opt.label}
                                      </span>
                                    )}
                                  </Listbox.Option>
                                ))}
                              </Listbox.Options>
                            </Transition>
                          </div>
                        </Listbox>
                      </div>
                    </div>

                    {/* Active Filters Display */}
                    {(bookingFilterProperty !== 'all' || bookingFilterStatus !== 'all' || bookingFilterMonth !== 'all') && (
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">Active filters:</span>
                        {bookingFilterProperty !== 'all' && (
                          <Badge variant="secondary" className="text-xs">
                            Property: {properties.find(p => p.id === bookingFilterProperty)?.name}
                            <button
                              onClick={() => setBookingFilterProperty('all')}
                              className="ml-1 hover:text-destructive"
                            >
                              ×
                            </button>
                          </Badge>
                        )}
                        {bookingFilterStatus !== 'all' && (
                          <Badge variant="secondary" className="text-xs">
                            Status: {bookingFilterStatus}
                            <button
                              onClick={() => setBookingFilterStatus('all')}
                              className="ml-1 hover:text-destructive"
                            >
                              ×
                            </button>
                          </Badge>
                        )}
                        {bookingFilterMonth !== 'all' && (
                          <Badge variant="secondary" className="text-xs">
                            Month: {(() => {
                              const [year, monthNum] = bookingFilterMonth.split('-').map(Number);
                              return new Date(year, monthNum - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                            })()}
                            <button
                              onClick={() => setBookingFilterMonth('all')}
                              className="ml-1 hover:text-destructive"
                            >
                              ×
                            </button>
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setBookingFilterProperty('all');
                            setBookingFilterStatus('all');
                            setBookingFilterMonth('all');
                          }}
                          className="h-6 text-xs cursor-pointer"
                        >
                          Clear all
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {bookings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No bookings yet.</p>
                ) : (
                  <div className="space-y-6">
                    {(() => {
                      // Apply filters
                      let filteredBookings = bookings.filter(b => {
                        if (bookingFilterProperty !== 'all' && b.property_id !== bookingFilterProperty) return false;
                        if (bookingFilterStatus !== 'all' && b.status !== bookingFilterStatus) return false;
                        if (bookingFilterMonth !== 'all' && !b.check_in.startsWith(bookingFilterMonth)) return false;
                        return true;
                      });

                      // Apply sorting
                      if (bookingSortBy === 'date-asc') {
                        filteredBookings.sort((a, b) => a.check_in.localeCompare(b.check_in));
                      } else if (bookingSortBy === 'date-desc') {
                        filteredBookings.sort((a, b) => b.check_in.localeCompare(a.check_in));
                      }

                      // Group by property
                      const groupedByProperty = properties.map(prop => ({
                        property: prop,
                        bookings: filteredBookings.filter(b => b.property_id === prop.id)
                      })).filter(group => group.bookings.length > 0);

                      if (groupedByProperty.length === 0) {
                        return <p className="text-sm text-muted-foreground">No bookings match the selected filters.</p>;
                      }

                      return groupedByProperty.map(({ property: prop, bookings: propBookings }) => {
                        const isPropertyExpanded = expandedBookingProperties.has(prop.id);

                        const toggleProperty = () => {
                          const newExpanded = new Set(expandedBookingProperties);
                          if (isPropertyExpanded) {
                            newExpanded.delete(prop.id);
                          } else {
                            newExpanded.add(prop.id);
                          }
                          setExpandedBookingProperties(newExpanded);
                        };

                        return (
                        <div key={prop.id} className="space-y-3 border border-border/50 rounded-lg p-4 bg-gradient-to-r from-muted/20 to-muted/10">
                          <button
                            onClick={toggleProperty}
                            className="w-full flex items-center justify-between hover:bg-[#E1ECDB]/10 p-2 rounded-lg transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                              </svg>
                              <h4 className="text-sm font-semibold text-foreground">{prop.name}</h4>
                              <Badge variant="outline" className="text-xs bg-primary/5 border-primary/20">
                                {propBookings.length} {propBookings.length === 1 ? 'booking' : 'bookings'}
                              </Badge>
                            </div>
                            <svg className={`w-5 h-5 text-[#9db896] transition-transform duration-300 ${isPropertyExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          <div
                            className="overflow-hidden transition-all duration-700 ease-in-out"
                            style={{
                              maxHeight: isPropertyExpanded ? '5000px' : '0px',
                              opacity: isPropertyExpanded ? 1 : 0,
                            }}
                          >
                          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {propBookings.map((booking) => (
                              <Card key={booking.id} className="group relative overflow-hidden hover:shadow-md transition-all duration-200 border-border/50 bg-gradient-to-br from-card to-card/80">
                                {/* Decorative top bar */}
                                <div className={`h-1 ${
                                  booking.status === 'completed' ? 'bg-primary' :
                                  booking.status === 'upcoming' ? 'bg-blue-500' :
                                  'bg-red-500'
                                }`}></div>

                                {/* Delete button */}
                                <button
                                  onClick={() => deleteBooking(booking.id)}
                                  className="absolute top-3 right-3 p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200 cursor-pointer opacity-0 group-hover:opacity-100"
                                  aria-label="Delete booking"
                                  title="Delete booking"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>

                                <div className="p-4 space-y-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        Check-in
                                      </div>
                                      <p className="text-sm font-medium text-foreground">
                                        {(() => {
                                          // Parse YYYY-MM-DD without timezone conversion
                                          const [year, month, day] = booking.check_in.split('-').map(Number);
                                          return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                        })()}
                                      </p>
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className={`text-xs font-medium ${
                                        booking.status === 'completed' ? 'bg-green-50 text-black border-green-200' :
                                        booking.status === 'upcoming' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                        'bg-red-50 text-red-700 border-red-200'
                                      }`}
                                    >
                                      {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                                    </Badge>
                                  </div>

                                  <div>
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                      Check-out
                                    </div>
                                    <p className="text-sm font-medium text-foreground">
                                      {(() => {
                                        // Parse YYYY-MM-DD without timezone conversion
                                        const [year, month, day] = booking.check_out.split('-').map(Number);
                                        return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                      })()}
                                    </p>
                                  </div>

                                  <Separator className="bg-border/50" />

                                  <div className="space-y-1.5">
                                    <Label htmlFor={`booking-status-${booking.id}`} className="text-xs text-muted-foreground">
                                      Update Status
                                    </Label>
                                    <Listbox value={booking.status} onChange={(val) => updateBookingStatus(booking.id, val as any)}>
                                      <div className="relative">
                                        <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-background py-2 pl-3 pr-10 text-left border border-input hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all text-sm">
                                          <span className="block truncate">
                                            {booking.status === 'upcoming' ? 'Upcoming' : booking.status === 'completed' ? 'Completed' : 'Cancelled'}
                                          </span>
                                          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                            <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                              <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                                            </svg>
                                          </span>
                                        </Listbox.Button>
                                        <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                                          <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar">
                                            {[
                                              { value: 'upcoming', label: 'Upcoming' },
                                              { value: 'completed', label: 'Completed' },
                                              { value: 'cancelled', label: 'Cancelled' },
                                            ].map((opt) => (
                                              <Listbox.Option
                                                key={opt.value}
                                                value={opt.value}
                                                className={({ active }) =>
                                                  `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`
                                                }
                                              >
                                                {({ selected }) => (
                                                  <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                                    {opt.label}
                                                  </span>
                                                )}
                                              </Listbox.Option>
                                            ))}
                                          </Listbox.Options>
                                        </Transition>
                                      </div>
                                    </Listbox>
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                          </div>
                        </div>
                        );
                      });
                    })()}
                  </div>
                )}
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
                      <Listbox value={ledgerPropertyId} onChange={setLedgerPropertyId}>
                        <div className="relative">
                          <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-background py-2.5 pl-3 pr-10 text-left border border-input hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all">
                            <span className="block truncate text-sm">
                              {ledgerPropertyId ? properties.find(p => p.id === ledgerPropertyId)?.name : 'Select property...'}
                            </span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                              </svg>
                            </span>
                          </Listbox.Button>
                          <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                            <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar">
                              <Listbox.Option
                                value=""
                                className={({ active }) =>
                                  `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`
                                }
                              >
                                {({ selected }) => (
                                  <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                    Select property...
                                  </span>
                                )}
                              </Listbox.Option>
                              {properties.map((prop) => (
                                <Listbox.Option
                                  key={prop.id}
                                  value={prop.id}
                                  className={({ active }) =>
                                    `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`
                                  }
                                >
                                  {({ selected }) => (
                                    <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                      {prop.name}
                                    </span>
                                  )}
                                </Listbox.Option>
                              ))}
                            </Listbox.Options>
                          </Transition>
                        </div>
                      </Listbox>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ledger-category">Type</Label>
                      <Listbox value={ledgerCategory} onChange={(val) => setLedgerCategory(val as any)}>
                        <div className="relative">
                          <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-background py-2.5 pl-3 pr-10 text-left border border-input hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all">
                            <span className="block truncate text-sm">
                              {ledgerCategory === 'revenue' ? 'Revenue' : 'Expense'}
                            </span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                              </svg>
                            </span>
                          </Listbox.Button>
                          <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                            <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar">
                              {[
                                { value: 'revenue', label: 'Revenue' },
                                { value: 'expense', label: 'Expense' },
                              ].map((opt) => (
                                <Listbox.Option
                                  key={opt.value}
                                  value={opt.value}
                                  className={({ active }) =>
                                    `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`
                                  }
                                >
                                  {({ selected }) => (
                                    <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                      {opt.label}
                                    </span>
                                  )}
                                </Listbox.Option>
                              ))}
                            </Listbox.Options>
                          </Transition>
                        </div>
                      </Listbox>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ledger-amount">Amount ($)</Label>
                      <Input
                        id="ledger-amount"
                        type="number"
                        step="0.01"
                        placeholder="100.00"
                        value={ledgerAmount}
                        onChange={(e) => setLedgerAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ledger-date" className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-[#9db896]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Date
                      </Label>
                      <div className="relative">
                        <Input
                          id="ledger-date"
                          type="date"
                          value={ledgerDate}
                          onChange={(e) => setLedgerDate(e.target.value)}
                          className="cursor-pointer pl-10 border-[#E1ECDB] focus:ring-[#9db896] focus:border-[#9db896] hover:border-[#9db896] transition-colors"
                          style={{ colorScheme: 'light' }}
                        />
                        <svg className="w-5 h-5 text-[#9db896] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
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

              {/* All Revenue/Expenses */}
              <div>
                <button
                  onClick={() => setIsAllEntriesExpanded(!isAllEntriesExpanded)}
                  className="w-full flex items-center justify-between mb-3 p-4 rounded-xl transition-all duration-500 cursor-pointer group relative overflow-hidden backdrop-blur-sm"
                  style={{
                    background: 'linear-gradient(135deg, #9db89605 0%, transparent 100%)',
                    border: '2px solid #9db89620',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #9db89615 0%, #9db89605 100%)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 16px -4px #9db89630';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #9db89605 0%, transparent 100%)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background: 'linear-gradient(90deg, #9db89600, #9db89640, #9db89600)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 3s infinite',
                      pointerEvents: 'none',
                    }}
                  />
                  <div className="flex items-center gap-3 relative z-10">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-12"
                      style={{
                        background: 'linear-gradient(135deg, #9db89620, #9db89640)',
                        boxShadow: '0 4px 12px #9db89630',
                      }}
                    >
                      <svg className="w-5 h-5 text-[#6b9b7a] transition-all duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-base font-bold">All Entries</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/20 text-foreground">
                          {ledgerEntries.length} total
                        </span>
                      </div>
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl backdrop-blur-md transition-all duration-500 group-hover:scale-105 relative z-10"
                    style={{
                      background: 'linear-gradient(135deg, #9db89615, #9db89625)',
                      border: '1px solid #9db89640',
                      boxShadow: '0 4px 12px #9db89620',
                    }}
                  >
                    <span className="text-xs font-bold tracking-wide text-foreground">
                      {isAllEntriesExpanded ? 'HIDE' : 'SHOW'}
                    </span>
                    <div className="relative w-5 h-5">
                      <svg
                        className={`absolute inset-0 transition-all duration-700 ${isAllEntriesExpanded ? 'rotate-180 scale-110' : 'rotate-0'}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        style={{ color: '#9db896' }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </button>

                <div
                  className="overflow-hidden transition-all duration-700 ease-in-out"
                  style={{
                    maxHeight: isAllEntriesExpanded ? '10000px' : '0px',
                    opacity: isAllEntriesExpanded ? 1 : 0,
                  }}
                >
                  <div className="flex flex-wrap items-center justify-end mb-3">
                  {/* Filters */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs">
                    {/* Month Filter */}
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Filter:</span>
                      <Listbox value={ledgerFilterMonth} onChange={setLedgerFilterMonth}>
                        <div className="relative">
                          <Listbox.Button className="relative cursor-pointer rounded-lg bg-background py-1.5 pl-3 pr-8 text-left border border-input hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all text-xs w-28 sm:w-36">
                            <span className="block truncate">
                              {ledgerFilterMonth === 'all' ? 'All Months' : (() => {
                                const [year, monthNum] = ledgerFilterMonth.split('-').map(Number);
                                return new Date(year, monthNum - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                              })()}
                            </span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                              </svg>
                            </span>
                          </Listbox.Button>
                          <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                            <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar text-xs">
                              <Listbox.Option
                                value="all"
                                className={({ active }) =>
                                  `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`
                                }
                              >
                                {({ selected }) => (
                                  <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                    All Months
                                  </span>
                                )}
                              </Listbox.Option>
                              {(() => {
                                const months = new Set<string>();
                                ledgerEntries.forEach(entry => {
                                  const month = entry.entry_date?.slice(0, 7);
                                  if (month) months.add(month);
                                });
                                return Array.from(months).sort().reverse().map(month => {
                                  const [year, monthNum] = month.split('-').map(Number);
                                  const label = new Date(year, monthNum - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                                  return (
                                    <Listbox.Option
                                      key={month}
                                      value={month}
                                      className={({ active }) =>
                                        `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`
                                      }
                                    >
                                      {({ selected }) => (
                                        <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                          {label}
                                        </span>
                                      )}
                                    </Listbox.Option>
                                  );
                                });
                              })()}
                            </Listbox.Options>
                          </Transition>
                        </div>
                      </Listbox>
                    </div>

                    {/* Property Filter */}
                    <div className="flex items-center gap-2">
                      <Listbox value={ledgerFilterProperty} onChange={setLedgerFilterProperty}>
                        <div className="relative">
                          <Listbox.Button className="relative cursor-pointer rounded-lg bg-background py-1.5 pl-3 pr-8 text-left border border-input hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all text-xs w-28 sm:w-36">
                            <span className="block truncate">
                              {ledgerFilterProperty === 'all' ? 'All Properties' : properties.find(p => p.id === ledgerFilterProperty)?.name}
                            </span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                              </svg>
                            </span>
                          </Listbox.Button>
                          <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                            <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar text-xs">
                              <Listbox.Option
                                value="all"
                                className={({ active }) =>
                                  `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`
                                }
                              >
                                {({ selected }) => (
                                  <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                    All Properties
                                  </span>
                                )}
                              </Listbox.Option>
                              {properties.map((prop) => (
                                <Listbox.Option
                                  key={prop.id}
                                  value={prop.id}
                                  className={({ active }) =>
                                    `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`
                                  }
                                >
                                  {({ selected }) => (
                                    <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                      {prop.name}
                                    </span>
                                  )}
                                </Listbox.Option>
                              ))}
                            </Listbox.Options>
                          </Transition>
                        </div>
                      </Listbox>
                    </div>

                    {/* Group By Toggle */}
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Group by:</span>
                      <div className="flex items-center gap-1 bg-muted/30 rounded-md p-1 border border-border">
                        <button
                          onClick={() => setLedgerGroupBy('month')}
                          className={`px-2 py-1 rounded transition-all cursor-pointer ${
                            ledgerGroupBy === 'month' ? 'bg-primary text-primary-foreground font-medium' : 'text-foreground hover:bg-muted/50'
                          }`}
                        >
                          Month
                        </button>
                        <button
                          onClick={() => setLedgerGroupBy('property')}
                          className={`px-2 py-1 rounded transition-all cursor-pointer ${
                            ledgerGroupBy === 'property' ? 'bg-primary text-primary-foreground font-medium' : 'text-foreground hover:bg-muted/50'
                          }`}
                        >
                          Property
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                {ledgerEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No entries yet.</p>
                ) : (
                  <div className="space-y-4">
                    {(() => {
                      // Filter entries by selected month and property
                      let filteredEntries = ledgerEntries;

                      if (ledgerFilterMonth !== 'all') {
                        filteredEntries = filteredEntries.filter(entry => entry.entry_date?.slice(0, 7) === ledgerFilterMonth);
                      }

                      if (ledgerFilterProperty !== 'all') {
                        filteredEntries = filteredEntries.filter(entry => entry.property_id === ledgerFilterProperty);
                      }

                      // Group entries by month or property
                      const grouped = filteredEntries.reduce((acc: Record<string, any[]>, entry) => {
                        const key = ledgerGroupBy === 'month'
                          ? entry.entry_date?.slice(0, 7) || 'no-date' // YYYY-MM
                          : entry.property_id || 'no-property';
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(entry);
                        return acc;
                      }, {});

                      return Object.entries(grouped).map(([key, entries]) => {
                        let groupLabel = '';
                        let groupIcon = null;

                        if (ledgerGroupBy === 'month') {
                          // Parse YYYY-MM to avoid timezone issues
                          const [year, month] = key.split('-').map(Number);
                          groupLabel = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                          groupIcon = (
                            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          );
                        } else {
                          groupLabel = entries[0]?.properties?.name || 'Unknown Property';
                          groupIcon = (
                            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          );
                        }

                        const totalRevenue = entries.filter(e => e.amount_cents > 0).reduce((sum, e) => sum + e.amount_cents, 0);
                        const totalExpenses = entries.filter(e => e.amount_cents < 0).reduce((sum, e) => sum + Math.abs(e.amount_cents), 0);
                        const isExpanded = expandedGroups.has(key);

                        const toggleGroup = () => {
                          const newExpanded = new Set(expandedGroups);
                          if (isExpanded) {
                            newExpanded.delete(key);
                          } else {
                            newExpanded.add(key);
                          }
                          setExpandedGroups(newExpanded);
                        };

                        return (
                          <div key={key} className="border border-border/50 rounded-lg p-4 bg-gradient-to-r from-muted/20 to-muted/10">
                            {/* Group Header */}
                            <button
                              onClick={toggleGroup}
                              className="w-full flex items-center justify-between mb-3 hover:bg-[#E1ECDB]/10 p-2 rounded-lg transition-colors cursor-pointer"
                            >
                              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                {groupIcon}
                                {groupLabel}
                                <Badge variant="outline" className="text-xs ml-1">{entries.length}</Badge>
                              </h4>
                              <div className="flex items-center gap-3 text-xs">
                                <span className="text-green-600 font-medium">+${(totalRevenue / 100).toFixed(2)}</span>
                                <span className="text-red-600 font-medium">-${(totalExpenses / 100).toFixed(2)}</span>
                                <svg className={`w-5 h-5 text-[#9db896] transition-transform duration-300 ml-2 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </button>

                            {/* Entries for this month */}
                            <div
                              className="overflow-hidden transition-all duration-700 ease-in-out"
                              style={{
                                maxHeight: isExpanded ? '5000px' : '0px',
                                opacity: isExpanded ? 1 : 0,
                              }}
                            >
                              <div className="space-y-2">
                              {entries.map((entry) => {
                                const isRevenue = entry.amount_cents > 0;
                                return (
                                  <Card key={entry.id} className="group hover:shadow-md transition-all duration-200 border-border/50 bg-card relative">
                                    {/* Delete Button */}
                                    <button
                                      onClick={() => deleteLedgerEntry(entry.id)}
                                      className="absolute top-2 right-2 p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200 cursor-pointer opacity-0 group-hover:opacity-100"
                                      title="Delete entry"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                    <div className="p-3 flex items-center justify-between gap-4">
                                      <div className="flex items-center gap-3 flex-1">
                                        {/* Icon */}
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                          isRevenue ? 'bg-green-100' : 'bg-red-100'
                                        }`}>
                                          <svg className={`w-4 h-4 ${isRevenue ? 'text-green-600' : 'text-red-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            {isRevenue ? (
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            ) : (
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            )}
                                          </svg>
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-0.5">
                                            <p className="text-sm font-medium text-foreground">{entry.description}</p>
                                            <Badge variant={isRevenue ? 'default' : 'secondary'} className={`text-xs ${
                                              isRevenue ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'
                                            }`}>
                                              {isRevenue ? 'Revenue' : 'Expense'}
                                            </Badge>
                                          </div>
                                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span>{entry.properties?.name || 'Unknown'}</span>
                                            <span>•</span>
                                            <span>{(() => {
                                              // Parse YYYY-MM-DD in PST to avoid timezone issues
                                              const [year, month, day] = entry.entry_date.split('-').map(Number);
                                              const date = new Date(year, month - 1, day);
                                              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' });
                                            })()}</span>
                                          </div>
                                        </div>

                                        {/* Amount */}
                                        <div className="text-right">
                                          <p className={`text-base font-bold ${isRevenue ? 'text-green-600' : 'text-red-600'}`}>
                                            {isRevenue ? '+' : '-'}${Math.abs(entry.amount_cents / 100).toFixed(2)}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </Card>
                                );
                              })}
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
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
                      <Listbox value={receiptPropertyId} onChange={setReceiptPropertyId}>
                        <div className="relative">
                          <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-background py-2.5 pl-4 pr-10 text-left border border-input hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all">
                            <span className="block truncate text-sm">
                              {receiptPropertyId ? properties.find(p => p.id === receiptPropertyId)?.name : 'Choose a property...'}
                            </span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                              </svg>
                            </span>
                          </Listbox.Button>
                          <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                            <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar">
                              <Listbox.Option
                                value=""
                                className={({ active }) =>
                                  `relative cursor-pointer select-none py-2 pl-4 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`
                                }
                              >
                                {({ selected }) => (
                                  <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                    Choose a property...
                                  </span>
                                )}
                              </Listbox.Option>
                              {properties.map((prop) => (
                                <Listbox.Option
                                  key={prop.id}
                                  value={prop.id}
                                  className={({ active }) =>
                                    `relative cursor-pointer select-none py-2 pl-4 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`
                                  }
                                >
                                  {({ selected }) => (
                                    <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                      {prop.name}
                                    </span>
                                  )}
                                </Listbox.Option>
                              ))}
                            </Listbox.Options>
                          </Transition>
                        </div>
                      </Listbox>
                    </div>

                    <Separator />

                    {/* Category Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="receipt-category" className="text-sm font-medium flex items-center gap-2">
                        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        Category
                      </Label>
                      <Listbox value={receiptCategory} onChange={setReceiptCategory}>
                        <div className="relative">
                          <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-background py-2.5 pl-4 pr-10 text-left border border-input hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all">
                            <span className="block truncate text-sm">
                              {receiptCategory || 'Choose a category...'}
                            </span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                              </svg>
                            </span>
                          </Listbox.Button>
                          <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                            <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar">
                              {[
                                { value: '', label: 'Choose a category...' },
                                { value: 'Cleanings', label: 'Cleanings' },
                                { value: 'Repairs', label: 'Repairs' },
                                { value: 'Maintenance', label: 'Maintenance' },
                                { value: 'Restocks', label: 'Restocks' },
                                { value: 'Photography', label: 'Photography' },
                              ].map((opt) => (
                                <Listbox.Option
                                  key={opt.value}
                                  value={opt.value}
                                  className={({ active }) =>
                                    `relative cursor-pointer select-none py-2 pl-4 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`
                                  }
                                >
                                  {({ selected }) => (
                                    <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                      {opt.label}
                                    </span>
                                  )}
                                </Listbox.Option>
                              ))}
                            </Listbox.Options>
                          </Transition>
                        </div>
                      </Listbox>
                    </div>

                    <Separator />

                    {/* Month/Year Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="receipt-month" className="text-sm font-medium flex items-center gap-2">
                        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Month & Year
                      </Label>
                      <Listbox value={receiptMonth} onChange={setReceiptMonth}>
                        <div className="relative">
                          <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-background py-2.5 pl-4 pr-10 text-left border border-input hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all">
                            <span className="block truncate text-sm">
                              {receiptMonth ? (() => {
                                const [year, monthNum] = receiptMonth.split('-').map(Number);
                                return new Date(year, monthNum - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                              })() : 'Choose a month...'}
                            </span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                              </svg>
                            </span>
                          </Listbox.Button>
                          <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                            <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar">
                              <Listbox.Option
                                value=""
                                className={({ active }) =>
                                  `relative cursor-pointer select-none py-2 pl-4 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`
                                }
                              >
                                {({ selected }) => (
                                  <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                    Choose a month...
                                  </span>
                                )}
                              </Listbox.Option>
                              {(() => {
                                const months = [];
                                const today = new Date();
                                for (let i = 0; i < 24; i++) {
                                  const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
                                  if (date.getFullYear() < 2025) continue;
                                  const monthStr = date.toISOString().slice(0, 7);
                                  const displayStr = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                                  months.push(
                                    <Listbox.Option
                                      key={monthStr}
                                      value={monthStr}
                                      className={({ active }) =>
                                        `relative cursor-pointer select-none py-2 pl-4 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`
                                      }
                                    >
                                      {({ selected }) => (
                                        <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                          {displayStr}
                                        </span>
                                      )}
                                    </Listbox.Option>
                                  );
                                }
                                return months;
                              })()}
                            </Listbox.Options>
                          </Transition>
                        </div>
                      </Listbox>
                    </div>

                    {/* Note/Description Field */}
                    <div className="space-y-2">
                      <Label htmlFor="receipt-note" className="text-sm font-medium flex items-center gap-2">
                        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Note (Optional)
                      </Label>
                      <textarea
                        id="receipt-note"
                        value={receiptNote}
                        onChange={(e) => setReceiptNote(e.target.value)}
                        placeholder="Add a note about this receipt (e.g., 'Broken window repair', 'Monthly deep clean', etc.)"
                        rows={3}
                        className="flex w-full rounded-lg border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 resize-none"
                      />
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
                      disabled={busyReceipt || !receiptPropertyId || !receiptFile || !receiptCategory || !receiptMonth}
                      className="w-full h-11 cursor-pointer transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
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
                          <svg className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

          {/* Receipt Organizer Section */}
          <CollapsibleSection
            title="Receipt Organizer"
            description="View and manage all receipts"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            }
          >
            <div className="space-y-6">
              {/* Filters */}
              <Card className="border-border/50">
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="receipt-filter-property" className="text-sm font-medium mb-2 block">
                        Filter by Property
                      </Label>
                      <Listbox value={receiptFilterProperty} onChange={setReceiptFilterProperty}>
                        <div className="relative">
                          <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-background py-2.5 pl-4 pr-10 text-left border border-input hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all">
                            <span className="block truncate text-sm">
                              {receiptFilterProperty === 'all' ? 'All Properties' : properties.find(p => p.id === receiptFilterProperty)?.name}
                            </span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                              </svg>
                            </span>
                          </Listbox.Button>
                          <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                            <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar">
                              <Listbox.Option value="all" className={({ active }) => `relative cursor-pointer select-none py-2 pl-4 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`}>
                                {({ selected }) => <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>All Properties</span>}
                              </Listbox.Option>
                              {properties.map(prop => (
                                <Listbox.Option key={prop.id} value={prop.id} className={({ active }) => `relative cursor-pointer select-none py-2 pl-4 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`}>
                                  {({ selected }) => <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>{prop.name}</span>}
                                </Listbox.Option>
                              ))}
                            </Listbox.Options>
                          </Transition>
                        </div>
                      </Listbox>
                    </div>
                    <div>
                      <Label htmlFor="receipt-filter" className="text-sm font-medium mb-2 block">
                        Filter by Category
                      </Label>
                      <Listbox value={receiptFilterCategory} onChange={setReceiptFilterCategory}>
                        <div className="relative">
                          <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-background py-2.5 pl-4 pr-10 text-left border border-input hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all">
                            <span className="block truncate text-sm">
                              {receiptFilterCategory === 'all' ? 'All Categories' : receiptFilterCategory}
                            </span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                              </svg>
                            </span>
                          </Listbox.Button>
                          <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                            <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar">
                              {[
                                { value: 'all', label: 'All Categories' },
                                { value: 'Cleanings', label: 'Cleanings' },
                                { value: 'Repairs', label: 'Repairs' },
                                { value: 'Maintenance', label: 'Maintenance' },
                                { value: 'Restocks', label: 'Restocks' },
                                { value: 'Photography', label: 'Photography' },
                              ].map((opt) => (
                                <Listbox.Option key={opt.value} value={opt.value} className={({ active }) => `relative cursor-pointer select-none py-2 pl-4 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`}>
                                  {({ selected }) => <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>{opt.label}</span>}
                                </Listbox.Option>
                              ))}
                            </Listbox.Options>
                          </Transition>
                        </div>
                      </Listbox>
                    </div>
                    <div>
                      <Label htmlFor="receipt-month-filter" className="text-sm font-medium mb-2 block">
                        Filter by Month
                      </Label>
                      <Listbox value={receiptFilterMonth} onChange={setReceiptFilterMonth}>
                        <div className="relative">
                          <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-background py-2.5 pl-4 pr-10 text-left border border-input hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all">
                            <span className="block truncate text-sm">
                              {receiptFilterMonth === 'all' ? 'All Months' : (() => {
                                const [year, monthNum] = receiptFilterMonth.split('-').map(Number);
                                return new Date(year, monthNum - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                              })()}
                            </span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                              </svg>
                            </span>
                          </Listbox.Button>
                          <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                            <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar">
                              <Listbox.Option value="all" className={({ active }) => `relative cursor-pointer select-none py-2 pl-4 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`}>
                                {({ selected }) => <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>All Months</span>}
                              </Listbox.Option>
                              {(() => {
                                const months = [];
                                const today = new Date();
                                for (let i = 0; i < 24; i++) {
                                  const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
                                  if (date.getFullYear() < 2025) continue;
                                  const monthStr = date.toISOString().slice(0, 7);
                                  const displayStr = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                                  months.push(
                                    <Listbox.Option key={monthStr} value={monthStr} className={({ active }) => `relative cursor-pointer select-none py-2 pl-4 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`}>
                                      {({ selected }) => <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>{displayStr}</span>}
                                    </Listbox.Option>
                                  );
                                }
                                return months;
                              })()}
                            </Listbox.Options>
                          </Transition>
                        </div>
                      </Listbox>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Receipts List */}
              <Card className="border-border/50">
                <div className="p-6 space-y-4">
                  {loadingReceipts ? (
                    <p className="text-center py-8 text-muted-foreground">Loading receipts...</p>
                  ) : receipts.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                      No receipts uploaded yet
                    </p>
                  ) : (() => {
                    // Apply filters
                    let filteredReceipts = receipts;

                    // Property filter
                    if (receiptFilterProperty !== 'all') {
                      filteredReceipts = filteredReceipts.filter(r =>
                        r.property_id === receiptFilterProperty
                      );
                    }

                    // Category filter
                    if (receiptFilterCategory !== 'all') {
                      filteredReceipts = filteredReceipts.filter(r =>
                        r.description?.toLowerCase() === receiptFilterCategory.toLowerCase()
                      );
                    }

                    // Month filter
                    if (receiptFilterMonth !== 'all') {
                      filteredReceipts = filteredReceipts.filter(r => {
                        if (!r.receipt_date) return false;
                        const receiptMonth = r.receipt_date.slice(0, 7); // Extract YYYY-MM
                        return receiptMonth === receiptFilterMonth;
                      });
                    }

                    return filteredReceipts.length === 0 ? (
                      <p className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                        No receipts found for selected filters
                      </p>
                    ) : (
                      <div className="grid gap-4">
                        {filteredReceipts.map((receipt: any) => (
                          <Card key={receipt.id} className="border-border hover:shadow-md transition-shadow overflow-hidden">
                            <div className="p-4">
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                <div className="flex-1 min-w-0 space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-semibold truncate">{receipt.file_name}</span>
                                    {receipt.mime_type?.includes('pdf') && (
                                      <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded shrink-0">PDF</span>
                                    )}
                                    {receipt.mime_type?.includes('image') && (
                                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded shrink-0">Image</span>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground space-y-1">
                                    <div className="truncate">Property: {properties.find(p => p.id === receipt.property_id)?.name || 'Unknown'}</div>
                                    {receipt.receipt_date && (
                                      <div>Month: <span className="font-medium">{(() => {
                                        // Parse YYYY-MM-DD and create date in local timezone to avoid UTC issues
                                        const [year, month] = receipt.receipt_date.split('-').map(Number);
                                        const date = new Date(year, month - 1, 15); // Use 15th to avoid timezone edge cases
                                        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                                      })()}</span></div>
                                    )}
                                    <div>Uploaded: {new Date(receipt.date_added).toLocaleDateString()}</div>
                                    {receipt.description && (
                                      <div>Category: <span className="font-medium text-primary">{receipt.description}</span></div>
                                    )}
                                    {receipt.note && (
                                      <div className="break-words">Note: <span className="font-medium text-foreground">{receipt.note}</span></div>
                                    )}
                                    {receipt.amount_cents !== null && (
                                      <div>Amount: ${(receipt.amount_cents / 100).toFixed(2)}</div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open(receipt.file_url, '_blank')}
                                  >
                                    <svg className="w-4 h-4 sm:mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    <span className="hidden sm:inline">Download</span>
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => deleteReceipt(receipt.id)}
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </Card>
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
                <Card className="border-border/50 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-sm">
                  <div className="p-6 space-y-4">
                    {/* Property Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="invoice-property" className="text-sm font-medium flex items-center gap-2">
                        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        Property
                      </Label>
                      <Listbox value={invoicePropertyId} onChange={setInvoicePropertyId}>
                        <div className="relative">
                          <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-background py-2.5 pl-4 pr-10 text-left border border-input hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all">
                            <span className="block truncate text-sm">
                              {invoicePropertyId ? properties.find(p => p.id === invoicePropertyId)?.name : 'All Properties (Organization Invoice)'}
                            </span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                              </svg>
                            </span>
                          </Listbox.Button>
                          <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                            <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar">
                              <Listbox.Option value="" className={({ active }) => `relative cursor-pointer select-none py-2 pl-4 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`}>
                                {({ selected }) => <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>All Properties (Organization Invoice)</span>}
                              </Listbox.Option>
                              {properties.map((prop) => (
                                <Listbox.Option key={prop.id} value={prop.id} className={({ active }) => `relative cursor-pointer select-none py-2 pl-4 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`}>
                                  {({ selected }) => <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>{prop.name}</span>}
                                </Listbox.Option>
                              ))}
                            </Listbox.Options>
                          </Transition>
                        </div>
                      </Listbox>
                      <p className="text-xs text-muted-foreground">
                        Select a specific property or leave blank to generate an invoice for all properties
                      </p>
                    </div>

                    <Separator />

                    {/* Month Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="invoice-month" className="text-sm font-medium flex items-center gap-2">
                        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Month
                      </Label>
                      <Input
                        id="invoice-month"
                        type="month"
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        className="h-11 cursor-pointer"
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      <Button onClick={generate} className="cursor-pointer w-full">
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Generate Invoice
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>

              <Separator />

              {/* All Invoices */}
              <div>
                <button
                  onClick={() => setIsAllInvoicesExpanded(!isAllInvoicesExpanded)}
                  className="w-full flex items-center justify-between mb-3 p-4 rounded-xl transition-all duration-500 cursor-pointer group relative overflow-hidden backdrop-blur-sm"
                  style={{
                    background: 'linear-gradient(135deg, #9db89605 0%, transparent 100%)',
                    border: '2px solid #9db89620',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #9db89615 0%, #9db89605 100%)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 16px -4px #9db89630';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #9db89605 0%, transparent 100%)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background: 'linear-gradient(90deg, #9db89600, #9db89640, #9db89600)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 3s infinite',
                      pointerEvents: 'none',
                    }}
                  />
                  <div className="flex items-center gap-3 relative z-10">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-12"
                      style={{
                        background: 'linear-gradient(135deg, #9db89620, #9db89640)',
                        boxShadow: '0 4px 12px #9db89630',
                      }}
                    >
                      <svg className="w-5 h-5 text-[#6b9b7a] transition-all duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-base font-bold">All Invoices</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/20 text-foreground">
                          {invoices.length} total
                        </span>
                      </div>
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl backdrop-blur-md transition-all duration-500 group-hover:scale-105 relative z-10"
                    style={{
                      background: 'linear-gradient(135deg, #9db89615, #9db89625)',
                      border: '1px solid #9db89640',
                      boxShadow: '0 4px 12px #9db89620',
                    }}
                  >
                    <span className="text-xs font-bold tracking-wide text-foreground">
                      {isAllInvoicesExpanded ? 'HIDE' : 'SHOW'}
                    </span>
                    <div className="relative w-5 h-5">
                      <svg
                        className={`absolute inset-0 transition-all duration-700 ${isAllInvoicesExpanded ? 'rotate-180 scale-110' : 'rotate-0'}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        style={{ color: '#9db896' }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </button>

                <div
                  className="overflow-hidden transition-all duration-700 ease-in-out"
                  style={{
                    maxHeight: isAllInvoicesExpanded ? '10000px' : '0px',
                    opacity: isAllInvoicesExpanded ? 1 : 0,
                  }}
                >
                  <div className="flex flex-wrap items-center justify-end mb-3">
                  {/* Group By Toggle & Month Filter */}
                  {invoices.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
                      {/* Group By Toggle */}
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Group by:</span>
                        <div className="flex rounded-md border border-border bg-background overflow-hidden">
                          <button
                            onClick={() => setInvoiceGroupBy('month')}
                            className={`px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                              invoiceGroupBy === 'month'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-background text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            Month
                          </button>
                          <button
                            onClick={() => setInvoiceGroupBy('property')}
                            className={`px-3 py-1 text-xs font-medium transition-colors cursor-pointer border-l border-border ${
                              invoiceGroupBy === 'property'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-background text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            Property
                          </button>
                        </div>
                      </div>
                      {/* Month Filter */}
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Filter:</span>
                        <Listbox value={invoiceFilterMonth} onChange={setInvoiceFilterMonth}>
                          <div className="relative">
                            <Listbox.Button className="relative cursor-pointer rounded-lg bg-background py-1.5 pl-3 pr-8 text-left border border-input hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all text-xs w-28 sm:w-36">
                              <span className="block truncate">
                                {invoiceFilterMonth === 'all' ? 'All Months' : (() => {
                                  const [year, monthNum] = invoiceFilterMonth.split('-').map(Number);
                                  return new Date(year, monthNum - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                                })()}
                              </span>
                              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                                </svg>
                              </span>
                            </Listbox.Button>
                            <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                              <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar text-xs">
                                <Listbox.Option value="all" className={({ active }) => `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`}>
                                  {({ selected }) => <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>All Months</span>}
                                </Listbox.Option>
                                {(() => {
                                  const months = new Set<string>();
                                  invoices.forEach(invoice => {
                                    const month = invoice.bill_month?.slice(0, 7);
                                    if (month) months.add(month);
                                  });
                                  return Array.from(months).sort().reverse().map(month => {
                                    const [year, monthNum] = month.split('-').map(Number);
                                    const label = new Date(year, monthNum - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                                    return (
                                      <Listbox.Option key={month} value={month} className={({ active }) => `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`}>
                                        {({ selected }) => <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>{label}</span>}
                                      </Listbox.Option>
                                    );
                                  });
                                })()}
                              </Listbox.Options>
                            </Transition>
                          </div>
                        </Listbox>
                      </div>

                      {/* Property Filter */}
                      <div className="flex items-center gap-2">
                        <Listbox value={invoiceFilterProperty} onChange={setInvoiceFilterProperty}>
                          <div className="relative">
                            <Listbox.Button className="relative cursor-pointer rounded-lg bg-background py-1.5 pl-3 pr-8 text-left border border-input hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all text-xs w-28 sm:w-36">
                              <span className="block truncate">
                                {invoiceFilterProperty === 'all' ? 'All Properties' : properties.find(p => p.id === invoiceFilterProperty)?.name}
                              </span>
                              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                                </svg>
                              </span>
                            </Listbox.Button>
                            <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                              <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar text-xs">
                                <Listbox.Option value="all" className={({ active }) => `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`}>
                                  {({ selected }) => <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>All Properties</span>}
                                </Listbox.Option>
                                {properties.map((prop) => (
                                  <Listbox.Option key={prop.id} value={prop.id} className={({ active }) => `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`}>
                                    {({ selected }) => <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>{prop.name}</span>}
                                  </Listbox.Option>
                                ))}
                              </Listbox.Options>
                            </Transition>
                          </div>
                        </Listbox>
                      </div>
                    </div>
                  )}
                </div>
                {invoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No invoices yet.</p>
                ) : (
                  <div className="space-y-4">
                    {(() => {
                      // Filter invoices by selected month and property
                      let filteredInvoices = invoices;

                      if (invoiceFilterMonth !== 'all') {
                        filteredInvoices = filteredInvoices.filter(invoice => invoice.bill_month?.slice(0, 7) === invoiceFilterMonth);
                      }

                      if (invoiceFilterProperty !== 'all') {
                        filteredInvoices = filteredInvoices.filter(invoice => invoice.property_id === invoiceFilterProperty);
                      }

                      // Group invoices by month or property
                      const grouped = filteredInvoices.reduce((acc: Record<string, any[]>, invoice) => {
                        const key = invoiceGroupBy === 'month'
                          ? invoice.bill_month?.slice(0, 7) || 'no-date'
                          : invoice.property_id || 'no-property';
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(invoice);
                        return acc;
                      }, {});

                      return Object.entries(grouped).map(([key, groupInvoices]) => {
                        // Determine label based on grouping
                        let groupLabel = '';
                        let groupIcon = null;
                        if (invoiceGroupBy === 'month') {
                          const [year, monthNum] = key.split('-').map(Number);
                          groupLabel = new Date(year, monthNum - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                          groupIcon = (
                            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          );
                        } else {
                          const property = properties.find(p => p.id === key);
                          groupLabel = property?.name || 'Unknown Property';
                          groupIcon = (
                            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          );
                        }

                        const totalDue = groupInvoices.reduce((sum, inv) => sum + (inv.amount_due_cents || 0), 0);
                        const paidCount = groupInvoices.filter(inv => inv.status === 'paid').length;
                        const isExpanded = expandedInvoiceGroups.has(key);

                        const toggleGroup = () => {
                          const newExpanded = new Set(expandedInvoiceGroups);
                          if (isExpanded) {
                            newExpanded.delete(key);
                          } else {
                            newExpanded.add(key);
                          }
                          setExpandedInvoiceGroups(newExpanded);
                        };

                        return (
                          <div key={key} className="border border-border/50 rounded-lg p-4 bg-gradient-to-r from-muted/20 to-muted/10">
                            {/* Group Header */}
                            <button
                              onClick={toggleGroup}
                              className="w-full flex items-center justify-between mb-3 hover:bg-[#E1ECDB]/10 p-2 rounded-lg transition-colors cursor-pointer"
                            >
                              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                {groupIcon}
                                {groupLabel}
                                <Badge variant="outline" className="text-xs ml-1">{groupInvoices.length}</Badge>
                              </h4>
                              <div className="flex items-center gap-3 text-xs">
                                <span className="text-muted-foreground">{paidCount} paid / {groupInvoices.length} total</span>
                                <span className="font-medium">${(totalDue / 100).toFixed(2)}</span>
                                <svg className={`w-5 h-5 text-[#9db896] transition-transform duration-300 ml-2 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </button>

                            {/* Invoices for this group */}
                            <div
                              className="overflow-hidden transition-all duration-700 ease-in-out"
                              style={{
                                maxHeight: isExpanded ? '5000px' : '0px',
                                opacity: isExpanded ? 1 : 0,
                              }}
                            >
                            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                              {groupInvoices.map((invoice) => (
                                <Card key={invoice.id} className="p-4 border-border/50 bg-card backdrop-blur-sm hover:shadow-md transition-all">
                                  <div className="space-y-3">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <h4 className="font-medium text-sm">{invoice.invoice_number || 'Invoice'}</h4>
                                          <button
                                            onClick={() => {
                                              navigator.clipboard.writeText(invoice.id);
                                              setMsg('✓ Invoice ID copied for payment');
                                              setTimeout(() => setMsg(null), 2000);
                                            }}
                                            className="p-1 hover:bg-primary/10 rounded transition-colors"
                                            title="Copy Invoice ID for Payment"
                                          >
                                            <svg className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                          </button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">ID: {invoice.id.slice(0, 8)}</p>
                                      </div>
                                      <Badge
                                        variant={invoice.status === 'paid' ? 'default' : 'outline'}
                                        className={
                                          invoice.status === 'paid'
                                            ? 'bg-green-100 text-green-700 border-green-200'
                                            : 'bg-red-100 text-red-700 border-red-200'
                                        }
                                      >
                                        {invoice.status === 'paid' ? 'Paid' : 'Due'}
                                      </Badge>
                                    </div>
                                    <p className="text-base font-bold">
                                      ${(invoice.amount_due_cents / 100).toFixed(2)}
                                    </p>
                                    {invoiceGroupBy === 'property' && invoice.bill_month && (
                                      <p className="text-xs text-muted-foreground">
                                        {invoice.bill_month}
                                      </p>
                                    )}
                                    {/* Action Buttons */}
                                    <div className="flex gap-2">
                                      <Button
                                        onClick={async () => {
                                          try {
                                            console.log('Downloading invoice PDF:', invoice.id);

                                            // First, try to get the PDF link from storage
                                            let res = await fetch(`/api/invoices/${invoice.id}/pdf-link`);
                                            let data = await res.json();
                                            console.log('PDF link response:', data);

                                            // If PDF doesn't exist in storage, generate it first
                                            if (!data.ok && data.needsArchive) {
                                              console.log('PDF not in storage, generating...');
                                              // Generate PDF (this will also upload it to storage)
                                              const pdfRes = await fetch(`/api/invoices/${invoice.id}/pdf`);
                                              console.log('PDF generation response status:', pdfRes.status);

                                              if (!pdfRes.ok) {
                                                const errorText = await pdfRes.text();
                                                console.error('PDF generation failed:', errorText);
                                                alert(`Failed to generate PDF: ${errorText}`);
                                                return;
                                              }

                                              // Now try to get the link again
                                              res = await fetch(`/api/invoices/${invoice.id}/pdf-link`);
                                              data = await res.json();
                                              console.log('PDF link response after generation:', data);
                                            }

                                            if (data.ok && data.url) {
                                              window.open(data.url, '_blank');
                                            } else {
                                              console.error('Failed to get PDF link:', data);
                                              alert(`Failed to generate PDF link: ${JSON.stringify(data)}`);
                                            }
                                          } catch (error) {
                                            console.error('PDF download error:', error);
                                            alert(`Error downloading PDF: ${error}`);
                                          }
                                        }}
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                                      >
                                        <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        Download
                                      </Button>
                                      <Button
                                        onClick={() => deleteInvoice(invoice.id)}
                                        variant="outline"
                                        size="sm"
                                        className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </Button>
                                    </div>
                                  </div>
                                </Card>
                              ))}
                            </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
                </div>
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
                      <Label htmlFor="payment-amount">Amount (CAD)</Label>
                      <Input
                        id="payment-amount"
                        type="number"
                        step="0.01"
                        placeholder="627.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button onClick={pay} className="cursor-pointer">Record Payment</Button>
                </div>
              </div>

              <Separator />

              {/* Payment Receipts */}
              <CollapsibleSection
                title="Payment Receipts"
                description={`${payments.length} payment${payments.length !== 1 ? 's' : ''} recorded`}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                }
                defaultOpen={true}
                onOpenChange={(open) => {
                  if (open && payments.length === 0) {
                    fetchPayments();
                  }
                }}
              >
                <div className="space-y-6">
                  <div>
                  <div className="space-y-4">
                    {/* Filters */}
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <Label htmlFor="payment-property-filter" className="text-xs mb-1">Filter by Property</Label>
                        <Listbox value={paymentPropertyFilter} onChange={setPaymentPropertyFilter}>
                          <div className="relative">
                            <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-background py-2.5 pl-3 pr-10 text-left border border-input hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all text-sm">
                              <span className="block truncate">{paymentPropertyFilter === 'all' ? 'All Properties' : paymentPropertyFilter}</span>
                              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                                </svg>
                              </span>
                            </Listbox.Button>
                            <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                              <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar">
                                <Listbox.Option value="all" className={({ active }) => `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`}>
                                  {({ selected }) => <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>All Properties</span>}
                                </Listbox.Option>
                                {Array.from(new Set(payments.map((p: any) => p.invoice?.property?.name).filter(Boolean))).map((propertyName: any) => (
                                  <Listbox.Option key={propertyName} value={propertyName} className={({ active }) => `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`}>
                                    {({ selected }) => <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>{propertyName}</span>}
                                  </Listbox.Option>
                                ))}
                              </Listbox.Options>
                            </Transition>
                          </div>
                        </Listbox>
                      </div>
                      <div className="flex-1">
                        <Label htmlFor="payment-date-filter" className="text-xs mb-1">Filter by Month</Label>
                        <Listbox value={paymentDateFilter} onChange={setPaymentDateFilter}>
                          <div className="relative">
                            <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-background py-2.5 pl-3 pr-10 text-left border border-input hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all text-sm">
                              <span className="block truncate">
                                {paymentDateFilter === 'all' ? 'All Months' : (() => {
                                  const [year, monthNum] = paymentDateFilter.split('-');
                                  return new Date(parseInt(year), parseInt(monthNum) - 1, 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
                                })()}
                              </span>
                              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                                </svg>
                              </span>
                            </Listbox.Button>
                            <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                              <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar">
                                <Listbox.Option value="all" className={({ active }) => `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`}>
                                  {({ selected }) => <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>All Months</span>}
                                </Listbox.Option>
                                {Array.from(new Set(payments.map((p: any) => p.invoice?.bill_month).filter(Boolean))).sort().reverse().map((month: any) => (
                                  <Listbox.Option key={month} value={month} className={({ active }) => `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`}>
                                    {({ selected }) => <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                      {(() => {
                                        const [year, monthNum] = month.split('-');
                                        return new Date(parseInt(year), parseInt(monthNum) - 1, 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
                                      })()}
                                    </span>}
                                  </Listbox.Option>
                                ))}
                              </Listbox.Options>
                            </Transition>
                          </div>
                        </Listbox>
                      </div>
                    </div>

                    {/* Payment List */}
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {payments.filter((payment: any) => {
                        const matchesProperty = paymentPropertyFilter === 'all' || payment.invoice?.property?.name === paymentPropertyFilter;
                        const matchesDate = paymentDateFilter === 'all' || payment.invoice?.bill_month === paymentDateFilter;
                        return matchesProperty && matchesDate;
                      }).length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          {payments.length === 0 ? 'No payments recorded yet' : 'No payments match the selected filters'}
                        </p>
                      ) : (
                        payments.filter((payment: any) => {
                          const matchesProperty = paymentPropertyFilter === 'all' || payment.invoice?.property?.name === paymentPropertyFilter;
                          const matchesDate = paymentDateFilter === 'all' || payment.invoice?.bill_month === paymentDateFilter;
                          return matchesProperty && matchesDate;
                        }).map((payment: any) => (
                          <Card key={payment.id} className="p-4 bg-muted/30 border-muted hover:border-primary/30 transition-colors relative">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Paid
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(payment.payment_date).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                      timeZone: 'America/Los_Angeles'
                                    })}
                                  </span>
                                </div>
                                <p className="font-medium text-sm mb-1">
                                  {payment.invoice?.invoice_number || 'Invoice'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {payment.invoice?.bill_month && (() => {
                                    const [year, month] = payment.invoice.bill_month.split('-').map(Number);
                                    return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'long'
                                    });
                                  })()}
                                </p>
                                {payment.invoice?.property?.name && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Property: {payment.invoice.property.name}
                                  </p>
                                )}
                                {payment.payment_method && (
                                  <p className="text-xs text-muted-foreground mt-1 capitalize">
                                    Method: {payment.payment_method}
                                  </p>
                                )}
                              </div>
                              <div className="text-right flex flex-col items-end gap-2">
                                <div>
                                  <p className="text-lg font-bold text-green-600">
                                    ${(payment.amount_cents / 100).toFixed(2)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">CAD</p>
                                </div>
                                <button
                                  onClick={() => deletePayment(payment.id)}
                                  className="p-1.5 hover:bg-red-50 rounded transition-colors group"
                                  title="Delete Payment"
                                >
                                  <svg className="w-4 h-4 text-muted-foreground group-hover:text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </Card>
                        ))
                      )}
                    </div>
                  </div>
                  </div>
                </div>
              </CollapsibleSection>
            </div>
          </CollapsibleSection>

          {/* Reviews Section */}
          <CollapsibleSection
            title="Reviews"
            description="Manage property reviews from Airbnb and VRBO"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            }
          >
            <div className="space-y-6">
              {/* Add Review Form */}
              <Card className="border-border/50">
                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-4 text-foreground">Add New Review</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="review-property" className="text-foreground">Property</Label>
                      <Listbox value={reviewPropertyId} onChange={setReviewPropertyId}>
                        <div className="relative mt-1">
                          <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-background py-2.5 pl-3 pr-10 text-left border border-input hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all">
                            <span className="block truncate text-sm">
                              {reviewPropertyId ? properties.find(p => p.id === reviewPropertyId)?.name || 'Select property…' : 'Select property…'}
                            </span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                              </svg>
                            </span>
                          </Listbox.Button>
                          <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                            <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar">
                              <Listbox.Option
                                value=""
                                className={({ active }) => `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
                              >
                                {({ selected }) => (
                                  <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                    Select property…
                                  </span>
                                )}
                              </Listbox.Option>
                              {properties.map((prop) => (
                                <Listbox.Option
                                  key={prop.id}
                                  value={prop.id}
                                  className={({ active }) => `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
                                >
                                  {({ selected }) => (
                                    <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                      {prop.name}
                                    </span>
                                  )}
                                </Listbox.Option>
                              ))}
                            </Listbox.Options>
                          </Transition>
                        </div>
                      </Listbox>
                    </div>

                    <div>
                      <Label htmlFor="review-platform" className="text-foreground">Platform</Label>
                      <Listbox value={reviewPlatform} onChange={(val: 'airbnb' | 'vrbo') => setReviewPlatform(val)}>
                        <div className="relative mt-1">
                          <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-background py-2.5 pl-3 pr-10 text-left border border-input hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all">
                            <span className="block truncate text-sm">
                              {reviewPlatform === 'airbnb' ? 'Airbnb (out of 5)' : 'VRBO (out of 10)'}
                            </span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                              </svg>
                            </span>
                          </Listbox.Button>
                          <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                            <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar">
                              <Listbox.Option
                                value="airbnb"
                                className={({ active }) => `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
                              >
                                {({ selected }) => (
                                  <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                    Airbnb (out of 5)
                                  </span>
                                )}
                              </Listbox.Option>
                              <Listbox.Option
                                value="vrbo"
                                className={({ active }) => `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
                              >
                                {({ selected }) => (
                                  <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                    VRBO (out of 10)
                                  </span>
                                )}
                              </Listbox.Option>
                            </Listbox.Options>
                          </Transition>
                        </div>
                      </Listbox>
                    </div>

                    <div>
                      <Label htmlFor="review-rating" className="text-foreground">
                        Rating (0-{reviewPlatform === 'airbnb' ? '5' : '10'})
                      </Label>
                      <Input
                        id="review-rating"
                        type="number"
                        step="0.1"
                        min="0"
                        max={reviewPlatform === 'airbnb' ? '5' : '10'}
                        value={reviewRating}
                        onChange={(e) => setReviewRating(e.target.value)}
                        placeholder={`e.g., ${reviewPlatform === 'airbnb' ? '4.5' : '9.0'}`}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="review-date" className="text-foreground">Review Date</Label>
                      <Input
                        id="review-date"
                        type="date"
                        value={reviewDate}
                        onChange={(e) => setReviewDate(e.target.value)}
                        className="mt-1"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label htmlFor="review-text" className="text-foreground">Review Text (Optional)</Label>
                      <textarea
                        id="review-text"
                        value={reviewText}
                        onChange={(e) => setReviewText(e.target.value)}
                        placeholder="Enter the review text..."
                        rows={3}
                        className="w-full mt-1 p-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={addReview}
                    disabled={busyReview}
                    className="mt-4"
                  >
                    {busyReview ? 'Adding...' : 'Add Review'}
                  </Button>
                </div>
              </Card>

              {/* Reviews List */}
              <Card className="border-border/50">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-foreground">
                      All Reviews ({reviews.length})
                    </h3>
                  </div>

                  {/* Filters and Sort */}
                  <div className="flex items-center gap-2 sm:gap-4 mb-4 flex-wrap text-xs sm:text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Property:</span>
                      <Listbox value={reviewFilterProperty} onChange={setReviewFilterProperty}>
                        <div className="relative">
                          <Listbox.Button className="relative w-28 sm:w-44 cursor-pointer rounded-lg bg-background py-2 pl-3 pr-10 text-left shadow-md border border-border hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all">
                            <span className="block truncate text-sm">
                              {reviewFilterProperty === 'all' ? 'All Properties' : properties.find(p => p.id === reviewFilterProperty)?.name || 'All Properties'}
                            </span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                              </svg>
                            </span>
                          </Listbox.Button>
                          <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                            <Listbox.Options className="absolute right-0 mt-1 max-h-60 w-44 overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 border border-border">
                              <Listbox.Option
                                value="all"
                                className={({ active }) =>
                                  `relative cursor-pointer select-none py-2 pl-3 pr-4 ${
                                    active ? 'bg-primary/10 text-primary' : 'text-foreground'
                                  }`
                                }
                              >
                                {({ selected }) => (
                                  <span className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}>
                                    All Properties
                                  </span>
                                )}
                              </Listbox.Option>
                              {properties.map((prop) => (
                                <Listbox.Option
                                  key={prop.id}
                                  value={prop.id}
                                  className={({ active }) =>
                                    `relative cursor-pointer select-none py-2 pl-3 pr-4 ${
                                      active ? 'bg-primary/10 text-primary' : 'text-foreground'
                                    }`
                                  }
                                >
                                  {({ selected }) => (
                                    <span className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}>
                                      {prop.name}
                                    </span>
                                  )}
                                </Listbox.Option>
                              ))}
                            </Listbox.Options>
                          </Transition>
                        </div>
                      </Listbox>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Platform:</span>
                      <Listbox value={reviewFilterPlatform} onChange={setReviewFilterPlatform}>
                        <div className="relative">
                          <Listbox.Button className="relative w-28 sm:w-44 cursor-pointer rounded-lg bg-background py-2 pl-3 pr-10 text-left shadow-md border border-border hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all">
                            <span className="block truncate text-sm">
                              {reviewFilterPlatform === 'all' && 'All Platforms'}
                              {reviewFilterPlatform === 'airbnb' && 'Airbnb'}
                              {reviewFilterPlatform === 'vrbo' && 'VRBO'}
                            </span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                              </svg>
                            </span>
                          </Listbox.Button>
                          <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                            <Listbox.Options className="absolute right-0 mt-1 max-h-60 w-44 overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 border border-border">
                              <Listbox.Option
                                value="all"
                                className={({ active }) =>
                                  `relative cursor-pointer select-none py-2 pl-3 pr-4 ${
                                    active ? 'bg-primary/10 text-primary' : 'text-foreground'
                                  }`
                                }
                              >
                                {({ selected }) => (
                                  <span className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}>
                                    All Platforms
                                  </span>
                                )}
                              </Listbox.Option>
                              <Listbox.Option
                                value="airbnb"
                                className={({ active }) =>
                                  `relative cursor-pointer select-none py-2 pl-3 pr-4 ${
                                    active ? 'bg-primary/10 text-primary' : 'text-foreground'
                                  }`
                                }
                              >
                                {({ selected }) => (
                                  <span className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}>
                                    Airbnb
                                  </span>
                                )}
                              </Listbox.Option>
                              <Listbox.Option
                                value="vrbo"
                                className={({ active }) =>
                                  `relative cursor-pointer select-none py-2 pl-3 pr-4 ${
                                    active ? 'bg-primary/10 text-primary' : 'text-foreground'
                                  }`
                                }
                              >
                                {({ selected }) => (
                                  <span className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}>
                                    VRBO
                                  </span>
                                )}
                              </Listbox.Option>
                            </Listbox.Options>
                          </Transition>
                        </div>
                      </Listbox>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Sort by:</span>
                      <Listbox value={reviewSortBy} onChange={setReviewSortBy}>
                        <div className="relative">
                          <Listbox.Button className="relative w-28 sm:w-44 cursor-pointer rounded-lg bg-background py-2 pl-3 pr-10 text-left shadow-md border border-border hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all">
                            <span className="block truncate text-sm">
                              {reviewSortBy === 'date-desc' && 'Newest First'}
                              {reviewSortBy === 'date-asc' && 'Oldest First'}
                              {reviewSortBy === 'rating-desc' && 'Highest Rating'}
                              {reviewSortBy === 'rating-asc' && 'Lowest Rating'}
                            </span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                              </svg>
                            </span>
                          </Listbox.Button>
                          <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                            <Listbox.Options className="absolute right-0 mt-1 max-h-60 w-44 overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 border border-border">
                              <Listbox.Option
                                value="date-desc"
                                className={({ active }) =>
                                  `relative cursor-pointer select-none py-2 pl-3 pr-4 ${
                                    active ? 'bg-primary/10 text-primary' : 'text-foreground'
                                  }`
                                }
                              >
                                {({ selected }) => (
                                  <span className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}>
                                    Newest First
                                  </span>
                                )}
                              </Listbox.Option>
                              <Listbox.Option
                                value="date-asc"
                                className={({ active }) =>
                                  `relative cursor-pointer select-none py-2 pl-3 pr-4 ${
                                    active ? 'bg-primary/10 text-primary' : 'text-foreground'
                                  }`
                                }
                              >
                                {({ selected }) => (
                                  <span className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}>
                                    Oldest First
                                  </span>
                                )}
                              </Listbox.Option>
                              <Listbox.Option
                                value="rating-desc"
                                className={({ active }) =>
                                  `relative cursor-pointer select-none py-2 pl-3 pr-4 ${
                                    active ? 'bg-primary/10 text-primary' : 'text-foreground'
                                  }`
                                }
                              >
                                {({ selected }) => (
                                  <span className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}>
                                    Highest Rating
                                  </span>
                                )}
                              </Listbox.Option>
                              <Listbox.Option
                                value="rating-asc"
                                className={({ active }) =>
                                  `relative cursor-pointer select-none py-2 pl-3 pr-4 ${
                                    active ? 'bg-primary/10 text-primary' : 'text-foreground'
                                  }`
                                }
                              >
                                {({ selected }) => (
                                  <span className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}>
                                    Lowest Rating
                                  </span>
                                )}
                              </Listbox.Option>
                            </Listbox.Options>
                          </Transition>
                        </div>
                      </Listbox>
                    </div>
                  </div>

                  {loadingReviews ? (
                    <div className="text-center py-8 text-muted-foreground">Loading reviews...</div>
                  ) : reviews.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No reviews yet</div>
                  ) : (
                    (() => {
                      // Filter reviews
                      let filteredReviews = reviews;

                      if (reviewFilterProperty !== 'all') {
                        filteredReviews = filteredReviews.filter(r => r.property_id === reviewFilterProperty);
                      }

                      if (reviewFilterPlatform !== 'all') {
                        filteredReviews = filteredReviews.filter(r => r.platform === reviewFilterPlatform);
                      }

                      // Sort reviews
                      const sortedReviews = [...filteredReviews].sort((a, b) => {
                        if (reviewSortBy === 'date-desc') {
                          return new Date(b.review_date).getTime() - new Date(a.review_date).getTime();
                        } else if (reviewSortBy === 'date-asc') {
                          return new Date(a.review_date).getTime() - new Date(b.review_date).getTime();
                        } else if (reviewSortBy === 'rating-desc') {
                          return b.rating - a.rating;
                        } else if (reviewSortBy === 'rating-asc') {
                          return a.rating - b.rating;
                        }
                        return 0;
                      });

                      if (sortedReviews.length === 0) {
                        return <div className="text-center py-8 text-muted-foreground">No reviews match the selected filters</div>;
                      }

                      return (
                        <div className="space-y-3">
                          {sortedReviews.map((review) => (
                            <Card key={review.id} className="border-border/50 bg-card/50">
                              <div className="p-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                      <Badge variant="secondary" className="capitalize">
                                        {review.properties?.name || 'Unknown Property'}
                                      </Badge>
                                      <img
                                        src={review.platform === 'airbnb' ? '/airbnb-logo.png' : '/vrbo-logo.png'}
                                        alt={review.platform === 'airbnb' ? 'Airbnb' : 'VRBO'}
                                        className={review.platform === 'airbnb' ? 'h-4 w-auto' : 'h-5 w-auto'}
                                      />
                                      <div className="flex items-center gap-1">
                                        <svg className="w-4 h-4 text-yellow-500 fill-current" viewBox="0 0 24 24">
                                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                        </svg>
                                        <span className="font-bold text-foreground">
                                          {review.rating} / {review.platform === 'airbnb' ? '5' : '10'}
                                        </span>
                                      </div>
                                      <span className="text-sm text-muted-foreground">
                                        {new Date(review.review_date).toLocaleDateString('en-US', {
                                          year: 'numeric',
                                          month: 'long',
                                          day: 'numeric'
                                        })}
                                      </span>
                                    </div>
                                    {review.review_text && (
                                      <p className="text-sm text-muted-foreground mt-2">{review.review_text}</p>
                                    )}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteReview(review.id)}
                                    className="ml-4 h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      );
                    })()
                  )}
                </div>
              </Card>
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
                        <Listbox value={selectedPlanTier} onChange={(val: Tier | '') => setSelectedPlanTier(val as Tier)}>
                          <div className="relative flex-1">
                            <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-background py-2.5 pl-3 pr-10 text-left border border-input hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all h-10">
                              <span className="block truncate text-sm">
                                {selectedPlanTier ? TIER_LABEL[selectedPlanTier] : 'Select plan...'}
                              </span>
                              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                                </svg>
                              </span>
                            </Listbox.Button>
                            <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                              <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border dropdown-scrollbar">
                                <Listbox.Option
                                  value=""
                                  className={({ active }) => `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
                                >
                                  {({ selected }) => (
                                    <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                      Select plan...
                                    </span>
                                  )}
                                </Listbox.Option>
                                <Listbox.Option
                                  value="launch"
                                  className={({ active }) => `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
                                >
                                  {({ selected }) => (
                                    <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                      {TIER_LABEL.launch}
                                    </span>
                                  )}
                                </Listbox.Option>
                                <Listbox.Option
                                  value="elevate"
                                  className={({ active }) => `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
                                >
                                  {({ selected }) => (
                                    <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                      {TIER_LABEL.elevate}
                                    </span>
                                  )}
                                </Listbox.Option>
                                <Listbox.Option
                                  value="maximize"
                                  className={({ active }) => `relative cursor-pointer select-none py-2 pl-3 pr-4 ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
                                >
                                  {({ selected }) => (
                                    <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                                      {TIER_LABEL.maximize}
                                    </span>
                                  )}
                                </Listbox.Option>
                              </Listbox.Options>
                            </Transition>
                          </div>
                        </Listbox>
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
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-sm">{invoice.invoice_number || 'Invoice'}</p>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(invoice.id);
                                      setMsg('✓ Invoice ID copied for payment');
                                      setTimeout(() => setMsg(null), 2000);
                                    }}
                                    className="p-1 hover:bg-primary/10 rounded transition-colors"
                                    title="Copy Invoice ID for Payment"
                                  >
                                    <svg className="w-3 h-3 text-muted-foreground hover:text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                  </button>
                                </div>
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
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col p-0">
          {selectedProperty && (
            <>
              {/* Header */}
              <div className="relative p-8 bg-gradient-to-br from-primary/5 via-background to-background border-b shrink-0">
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl -mr-48 -mt-48"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-primary/5 to-transparent rounded-full blur-2xl -ml-32 -mb-32"></div>

                <div className="relative">
                  <DialogTitle className="text-3xl font-bold mb-3 flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-primary/10 text-primary">
                      {getPropertyIcon(selectedProperty.property_type)}
                    </div>
                    <div>
                      {selectedProperty.name}
                      {selectedProperty.assigned_user && (
                        <div className="text-sm font-normal text-muted-foreground mt-1">
                          Managed by {selectedProperty.assigned_user.first_name} {selectedProperty.assigned_user.last_name}
                        </div>
                      )}
                    </div>
                  </DialogTitle>
                  <div className="flex items-center gap-3 flex-wrap">
                    {selectedProperty.address && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card/50 border border-border/50">
                        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-sm">{selectedProperty.address}</span>
                      </div>
                    )}
                    {selectedProperty.property_type && (
                      <Badge variant="secondary" className="text-sm px-3 py-1 bg-primary/10 border-primary/20 text-black">
                        {selectedProperty.property_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </Badge>
                    )}
                    {selectedProperty.airbnb_link && (
                      <a
                        href={selectedProperty.airbnb_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors text-sm font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        View on Airbnb
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Month Selector & Content */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-8 space-y-6">
                  {/* Month Selector */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-card/50 border border-border/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <Label htmlFor="property-month" className="text-sm font-medium text-muted-foreground">Performance Period</Label>
                        <div className="text-lg font-semibold">
                          {new Date(propertyMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </div>
                      </div>
                    </div>
                    <Input
                      id="property-month"
                      type="month"
                      value={propertyMonth}
                      onChange={async (e) => {
                        setPropertyMonth(e.target.value);
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
                      className="w-56 cursor-pointer"
                    />
                  </div>

                  {/* KPI Metrics */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-foreground">Performance Metrics</h3>
                      <Badge variant="outline" className="text-xs">
                        Last Updated: {new Date().toLocaleDateString()}
                      </Badge>
                    </div>

                {propertyKpis ? (
                  <>
                    {/* Main Metrics Grid */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      {/* Gross Revenue */}
                      <Card className="group relative p-5 bg-gradient-to-br from-green-50 via-green-50/50 to-background border-green-200 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full blur-2xl"></div>
                        <div className="relative">
                          <div className="flex items-start justify-between mb-3">
                            <div className="p-2 rounded-lg bg-green-100 text-green-700">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div className="p-1.5 rounded-md bg-green-100/50">
                              <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                              </svg>
                            </div>
                          </div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Gross Revenue</p>
                          <p className="text-3xl font-bold text-green-700 tracking-tight">
                            ${((propertyKpis.gross_revenue_cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </Card>

                      {/* Expenses */}
                      <Card className="group relative p-5 bg-gradient-to-br from-red-50 via-red-50/50 to-background border-red-200 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl"></div>
                        <div className="relative">
                          <div className="flex items-start justify-between mb-3">
                            <div className="p-2 rounded-lg bg-red-100 text-red-700">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                              </svg>
                            </div>
                            <div className="p-1.5 rounded-md bg-red-100/50">
                              <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                              </svg>
                            </div>
                          </div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Expenses</p>
                          <p className="text-3xl font-bold text-red-700 tracking-tight">
                            ${((propertyKpis.expenses_cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </Card>

                      {/* Net Revenue */}
                      <Card className="group relative p-5 bg-gradient-to-br from-blue-50 via-blue-50/50 to-background border-blue-200 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl"></div>
                        <div className="relative">
                          <div className="flex items-start justify-between mb-3">
                            <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                            </div>
                            <div className="p-1.5 rounded-md bg-blue-100/50">
                              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                              </svg>
                            </div>
                          </div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Net Revenue</p>
                          <p className="text-3xl font-bold text-blue-700 tracking-tight">
                            ${(() => {
                              const grossRevenue = propertyKpis.gross_revenue_cents || 0;
                              const expenses = propertyKpis.expenses_cents || 0;
                              const feePercent = propertyKpis.fee_percent || 12;
                              const truHostFees = Math.floor((grossRevenue * feePercent) / 100);
                              const netRevenue = (grossRevenue - expenses - truHostFees) / 100;
                              return netRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            })()}
                          </p>
                        </div>
                      </Card>

                      {/* Nights Booked */}
                      <Card className="group relative p-5 bg-gradient-to-br from-cyan-50 via-cyan-50/50 to-background border-cyan-200 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl"></div>
                        <div className="relative">
                          <div className="flex items-start justify-between mb-3">
                            <div className="p-2 rounded-lg bg-cyan-100 text-cyan-700">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                              </svg>
                            </div>
                            <div className="p-1.5 rounded-md bg-cyan-100/50">
                              <svg className="w-4 h-4 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          </div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Nights Booked</p>
                          <p className="text-3xl font-bold text-cyan-700 tracking-tight">
                            {(propertyKpis.nights_booked || 0).toLocaleString()}
                          </p>
                        </div>
                      </Card>

                    </div>

                    {/* Secondary Metrics Grid */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      {/* Occupancy Rate */}
                      <Card className="group relative p-5 bg-gradient-to-br from-purple-50 via-purple-50/50 to-background border-purple-200 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl"></div>
                        <div className="relative">
                          <div className="flex items-start justify-between mb-3">
                            <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                            </div>
                            <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 border-purple-200">
                              {((propertyKpis.occupancy_rate || 0) * 100).toFixed(1)}%
                            </Badge>
                          </div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Occupancy Rate</p>
                          <div className="w-full bg-purple-100 rounded-full h-2.5 overflow-hidden">
                            <div className="bg-purple-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${((propertyKpis.occupancy_rate || 0) * 100).toFixed(1)}%` }}></div>
                          </div>
                        </div>
                      </Card>

                      {/* Vacancy Rate */}
                      <Card className="group relative p-5 bg-gradient-to-br from-orange-50 via-orange-50/50 to-background border-orange-200 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full blur-2xl"></div>
                        <div className="relative">
                          <div className="flex items-start justify-between mb-3">
                            <div className="p-2 rounded-lg bg-orange-100 text-orange-700">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                              </svg>
                            </div>
                            <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700 border-orange-200">
                              {((propertyKpis.vacancy_rate || 0) * 100).toFixed(1)}%
                            </Badge>
                          </div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Vacancy Rate</p>
                          <div className="w-full bg-orange-100 rounded-full h-2.5 overflow-hidden">
                            <div className="bg-orange-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${((propertyKpis.vacancy_rate || 0) * 100).toFixed(1)}%` }}></div>
                          </div>
                        </div>
                      </Card>

                      {/* TruHost Fees */}
                      <Card className="group relative p-5 bg-gradient-to-br from-slate-50 via-slate-50/50 to-background border-slate-200 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-slate-500/5 rounded-full blur-2xl"></div>
                        <div className="relative">
                          <div className="flex items-start justify-between mb-3">
                            <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                            </div>
                            <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-700 border-slate-200">
                              {propertyKpis.fee_percent || 12}%
                            </Badge>
                          </div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">TruHost Fees</p>
                          <p className="text-2xl font-bold text-slate-700 tracking-tight">
                            ${(((propertyKpis.gross_revenue_cents || 0) * (propertyKpis.fee_percent || 12)) / 10000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </Card>

                      {/* Properties Count (if aggregate) */}
                      {propertyKpis.properties && (
                        <Card className="group relative p-5 bg-gradient-to-br from-indigo-50 via-indigo-50/50 to-background border-indigo-200 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 overflow-hidden">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl"></div>
                          <div className="relative">
                            <div className="flex items-start justify-between mb-3">
                              <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                              </div>
                            </div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">Properties</p>
                            <p className="text-3xl font-bold text-indigo-700 tracking-tight">
                              {propertyKpis.properties}
                            </p>
                          </div>
                        </Card>
                      )}
                    </div>
                  </>
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
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
