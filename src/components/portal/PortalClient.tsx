'use client';

import { useState, useEffect, Fragment } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { supabaseClient } from '@/lib/supabase/client';
import MetricChart from './MetricChart';
import ReceiptsModal from './ReceiptsModal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { formatMoney, formatNumber, formatPercent } from '@/lib/utils';
import { Listbox, Transition } from '@headlessui/react';

type KPI = {
  org_id: string;
  month: string;
  gross_revenue_cents: number;
  expenses_cents: number;
  net_revenue_cents: number;
  nights_booked: number;
  properties: number;
  occupancy_rate: number;
  vacancy_rate: number;
};

type Invoice = {
  id: string;
  invoice_number: string | null;
  bill_month: string;
  amount_due_cents: number | null;
  status: 'due' | 'paid' | 'void';
};

type Plan = { tier: 'launch' | 'elevate' | 'maximize'; percent: number };

type MetricType =
  | 'gross_revenue'
  | 'net_revenue'
  | 'expenses'
  | 'occupancy_rate'
  | 'vacancy_rate'
  | 'nights_booked';

type Property = {
  id: string;
  name: string;
};

type Booking = {
  id: string;
  property_id: string;
  check_in: string;
  check_out: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  properties: { name: string } | null;
};

interface PortalClientProps {
  orgId: string;
  month: string;
  kpi: KPI | null;
  invoices: Invoice[];
  plan: Plan | null;
  properties: Property[];
}

export default function PortalClient({ orgId, month, kpi, invoices, plan: serverPlan, properties }: PortalClientProps) {
  console.log('PortalClient - Server plan received:', serverPlan);
  const pathname = usePathname();
  const router = useRouter();
  const isProfilePage = pathname?.includes('/profile');
  const sb = supabaseClient();

  // Client-side plan state (fallback if server plan is null)
  const [clientPlan, setClientPlan] = useState<Plan | null>(null);
  const plan = serverPlan || clientPlan;

  // User role for admin access
  const [userRole, setUserRole] = useState<string | null>(null);

  const [activeChart, setActiveChart] = useState<{
    type: MetricType;
    title: string;
  } | null>(null);

  const [showReceiptsModal, setShowReceiptsModal] = useState(false);

  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [propertyKpi, setPropertyKpi] = useState<KPI | null>(null);
  const [loadingPropertyKpi, setLoadingPropertyKpi] = useState(false);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [ledgerFilterMonth, setLedgerFilterMonth] = useState<string>('all');
  const [expandedInvoiceMonths, setExpandedInvoiceMonths] = useState<Set<string>>(new Set());
  const [invoiceFilterMonth, setInvoiceFilterMonth] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'monthly' | 'annual'>('monthly');
  const [annualKpis, setAnnualKpis] = useState<KPI[]>([]);
  const [loadingAnnual, setLoadingAnnual] = useState(false);

  // Section collapse states
  const [isPerformanceExpanded, setIsPerformanceExpanded] = useState(true);
  const [isInvoicesExpanded, setIsInvoicesExpanded] = useState(false);
  const [isRevenueExpanded, setIsRevenueExpanded] = useState(false);
  const [isBookingsExpanded, setIsBookingsExpanded] = useState(false);
  const [isReviewsExpanded, setIsReviewsExpanded] = useState(false);

  // Unread messages count
  const [unreadCount, setUnreadCount] = useState(0);

  // User info
  const [userName, setUserName] = useState<string>('');

  // Bookings state
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingFilterStatus, setBookingFilterStatus] = useState<string>('all');
  const [expandedBookingStatuses, setExpandedBookingStatuses] = useState<Set<string>>(new Set(['upcoming', 'completed', 'cancelled']));

  // Reviews state
  const [reviews, setReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // Generate month options (January to December of current year)
  const generateMonthOptions = () => {
    const months = [];
    const currentYear = new Date().getFullYear();
    for (let i = 0; i < 12; i++) {
      const monthStr = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
      const date = new Date(currentYear, i, 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'long' });
      months.push({ value: monthStr, label: monthName });
    }
    return months;
  };

  const monthOptions = generateMonthOptions();

  const handleMonthChange = (newMonth: string) => {
    router.push(`/portal/${orgId}?month=${newMonth}`);
  };

  const handleLogout = async () => {
    await sb.auth.signOut();
    router.push('/login');
  };

  const toggleMonthExpanded = (month: string) => {
    setExpandedMonths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(month)) {
        newSet.delete(month);
      } else {
        newSet.add(month);
      }
      return newSet;
    });
  };

  const toggleInvoiceMonthExpanded = (month: string) => {
    setExpandedInvoiceMonths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(month)) {
        newSet.delete(month);
      } else {
        newSet.add(month);
      }
      return newSet;
    });
  };

  const toggleBookingStatusExpanded = (status: string) => {
    setExpandedBookingStatuses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(status)) {
        newSet.delete(status);
      } else {
        newSet.add(status);
      }
      return newSet;
    });
  };

  // Fetch ledger entries
  const fetchLedgerEntries = async () => {
    try {
      const { data: { session } } = await sb.auth.getSession();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/orgs/${orgId}/ledger`, { headers });
      const data = await response.json();
      console.log('Member portal - Fetched ledger entries:', data);
      if (data.ok && data.entries) {
        setLedgerEntries(data.entries);
        console.log('Member portal - Set ledger entries:', data.entries);
      } else {
        setLedgerEntries([]);
      }
    } catch (error) {
      console.error('Error fetching ledger entries:', error);
      setLedgerEntries([]);
    }
  };

  // Fetch bookings
  const fetchBookings = async () => {
    try {
      const { data: { session } } = await sb.auth.getSession();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/orgs/${orgId}/bookings`, { headers });
      const data = await response.json();
      console.log('Member portal - Fetched bookings:', data);
      if (data.ok && data.bookings) {
        setBookings(data.bookings);
        console.log('Member portal - Set bookings:', data.bookings);
      } else {
        setBookings([]);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setBookings([]);
    }
  };

  const fetchReviews = async () => {
    setLoadingReviews(true);
    try {
      const { data: { session } } = await sb.auth.getSession();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/orgs/${orgId}/reviews`, { headers });
      const data = await response.json();
      if (data.ok && data.reviews) {
        setReviews(data.reviews);
      } else {
        setReviews([]);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  };


  // Fetch property-specific KPIs when a property is selected
  useEffect(() => {
    if (!selectedPropertyId) {
      setPropertyKpi(null);
      return;
    }

    const fetchPropertyKpi = async () => {
      setLoadingPropertyKpi(true);
      try {
        const response = await fetch(
          `/api/orgs/${orgId}/properties/${selectedPropertyId}/kpis?month=${month}`
        );
        const data = await response.json();
        if (data.ok && data.kpi) {
          setPropertyKpi(data.kpi);
        } else {
          setPropertyKpi(null);
        }
      } catch (error) {
        console.error('Error fetching property KPI:', error);
        setPropertyKpi(null);
      } finally {
        setLoadingPropertyKpi(false);
      }
    };

    fetchPropertyKpi();
  }, [selectedPropertyId, orgId, month]);

  // Fetch user name and role on mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return;

        // Fetch profile for name
        const { data: profile } = await sb
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single();

        if (profile) {
          setUserName(profile.first_name || 'there');
        }

        // Fetch role from org_memberships
        const { data: membership } = await sb
          .from('org_memberships')
          .select('role')
          .eq('user_id', user.id)
          .eq('org_id', orgId)
          .single();

        if (membership) {
          setUserRole(membership.role);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, [orgId]);

  // Fetch ledger entries and bookings on mount
  useEffect(() => {
    fetchLedgerEntries();
    fetchBookings();
    fetchUnreadCount();
    fetchReviews();
  }, [orgId]);

  // Fetch plan client-side if server didn't provide one
  useEffect(() => {
    if (serverPlan) {
      console.log('PortalClient - Using server-provided plan:', serverPlan);
      return;
    }

    const fetchPlan = async () => {
      try {
        console.log('PortalClient - Fetching plan client-side for org:', orgId);
        const { data: { session } } = await sb.auth.getSession();
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const response = await fetch(`/api/orgs/${orgId}/plan`, { headers });
        const data = await response.json();
        console.log('PortalClient - Plan API response:', data);

        if (data.ok && data.plan) {
          console.log('PortalClient - Setting client plan:', data.plan);
          setClientPlan(data.plan);
        }
      } catch (error) {
        console.error('Error fetching plan client-side:', error);
      }
    };

    fetchPlan();
  }, [orgId, serverPlan]);

  // Fetch unread messages count
  const fetchUnreadCount = async () => {
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return;

      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/orgs/${orgId}/messages/unread`, { headers });
      const data = await response.json();

      if (data.ok) {
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  // Poll for unread messages every 30 seconds
  useEffect(() => {
    if (!orgId) return;

    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [orgId]);

  // Fetch annual KPIs when view mode changes to annual
  useEffect(() => {
    if (viewMode !== 'annual') return;

    const fetchAnnualKpis = async () => {
      setLoadingAnnual(true);
      try {
        // Get the current year
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;

        // Fetch all KPIs for the current year
        const allKpis: KPI[] = [];
        for (let m = 1; m <= currentMonth; m++) {
          const monthStr = `${currentYear}-${String(m).padStart(2, '0')}`;

          // Get the auth session and token
          const { data: { session } } = await sb.auth.getSession();
          const headers: HeadersInit = { 'Content-Type': 'application/json' };
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
          }

          // If a specific property is selected, fetch property KPIs
          if (selectedPropertyId) {
            const response = await fetch(
              `/api/orgs/${orgId}/properties/${selectedPropertyId}/kpis?month=${monthStr}`,
              { headers }
            );
            const data = await response.json();
            if (data.ok && data.kpi) {
              allKpis.push({ ...data.kpi, month: monthStr });
            }
          } else {
            // Fetch user-level KPIs for all properties
            const response = await fetch(
              `/api/kpis?org=${orgId}&month=${monthStr}`,
              { headers }
            );
            const data = await response.json();
            if (data.ok && data.kpis && data.kpis.length > 0) {
              allKpis.push(data.kpis[0]);
            }
          }
        }

        setAnnualKpis(allKpis);
      } catch (error) {
        console.error('Error fetching annual KPIs:', error);
        setAnnualKpis([]);
      } finally {
        setLoadingAnnual(false);
      }
    };

    fetchAnnualKpis();
  }, [viewMode, orgId, selectedPropertyId, sb]);

  const handlePropertyChange = (propertyId: string) => {
    if (propertyId === 'all') {
      setSelectedPropertyId(null);
    } else {
      setSelectedPropertyId(propertyId);
    }
  };

  // Use property KPI if a property is selected, otherwise use org-level KPI
  const displayKpi = selectedPropertyId && propertyKpi ? propertyKpi : kpi;
  const selectedProperty = properties.find(p => p.id === selectedPropertyId);

  // Calculate year-to-date totals if in annual view
  const annualTotals = viewMode === 'annual' && annualKpis.length > 0
    ? {
        gross_revenue_cents: annualKpis.reduce((sum, k) => sum + (k.gross_revenue_cents || 0), 0),
        expenses_cents: annualKpis.reduce((sum, k) => sum + (k.expenses_cents || 0), 0),
        net_revenue_cents: annualKpis.reduce((sum, k) => sum + (k.net_revenue_cents || 0), 0),
        nights_booked: annualKpis.reduce((sum, k) => sum + (k.nights_booked || 0), 0),
        properties: displayKpi?.properties || 0,
        // Calculate average occupancy/vacancy rates
        occupancy_rate: annualKpis.reduce((sum, k) => sum + (k.occupancy_rate || 0), 0) / annualKpis.length,
        vacancy_rate: annualKpis.reduce((sum, k) => sum + (k.vacancy_rate || 0), 0) / annualKpis.length,
        org_id: displayKpi?.org_id || orgId,
        month: 'YTD',
      }
    : null;

  // Use annual totals if in annual view, otherwise use display KPI
  const activeKpi = viewMode === 'annual' ? annualTotals : displayKpi;

  // Calculate plan fees based on gross revenue and plan percentage
  const planFeesInCents = plan && activeKpi ? Math.floor((activeKpi.gross_revenue_cents * plan.percent) / 100) : 0;

  // Helper function to get icon SVG for each metric
  const getMetricIcon = (metricType: string, isReceipts: boolean) => {
    if (isReceipts) {
      return (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    }

    switch (metricType) {
      case 'gross_revenue':
        return (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'expenses':
        return (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        );
      case 'net_revenue':
        return (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        );
      case 'nights_booked':
        return (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        );
      case 'occupancy_rate':
        return (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      case 'vacancy_rate':
        return (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
        );
    }
  };

  const metricCards = [
    {
      label: 'Gross Revenue',
      value: formatMoney(activeKpi?.gross_revenue_cents),
      metricType: 'gross_revenue' as MetricType,
      isReceipts: false,
      gradient: 'from-emerald-500/10 to-green-500/5',
      iconBg: 'bg-gradient-to-br from-emerald-500 to-green-600',
      iconColor: 'text-white',
      accentColor: 'border-l-emerald-500/30',
      hoverShadow: 'hover:shadow-emerald-500/20',
    },
    {
      label: 'Expenses',
      value: formatMoney(activeKpi?.expenses_cents),
      metricType: 'expenses' as MetricType,
      isReceipts: false,
      gradient: 'from-orange-500/10 to-red-500/5',
      iconBg: 'bg-gradient-to-br from-orange-500 to-red-600',
      iconColor: 'text-white',
      accentColor: 'border-l-orange-500/30',
      hoverShadow: 'hover:shadow-orange-500/20',
    },
    {
      label: `TruHost Fees (${plan?.percent || 0}%)`,
      value: formatMoney(planFeesInCents),
      metricType: 'expenses' as MetricType,
      isReceipts: false,
      isCalculated: true,
      gradient: 'from-purple-500/10 to-indigo-500/5',
      iconBg: 'bg-gradient-to-br from-purple-500 to-indigo-600',
      iconColor: 'text-white',
      accentColor: 'border-l-purple-500/30',
      hoverShadow: 'hover:shadow-purple-500/20',
    },
    {
      label: 'Net Revenue',
      value: formatMoney(activeKpi?.net_revenue_cents),
      metricType: 'net_revenue' as MetricType,
      isReceipts: false,
      gradient: 'from-green-500/10 to-teal-500/5',
      iconBg: 'bg-gradient-to-br from-green-500 to-teal-600',
      iconColor: 'text-white',
      accentColor: 'border-l-green-500/30',
      hoverShadow: 'hover:shadow-green-500/20',
    },
    {
      label: 'Nights Booked',
      value: formatNumber(activeKpi?.nights_booked),
      metricType: 'nights_booked' as MetricType,
      isReceipts: false,
      gradient: 'from-blue-500/10 to-cyan-500/5',
      iconBg: 'bg-gradient-to-br from-blue-500 to-cyan-600',
      iconColor: 'text-white',
      accentColor: 'border-l-blue-500/30',
      hoverShadow: 'hover:shadow-blue-500/20',
    },
    {
      label: 'Occupancy',
      value: formatPercent(activeKpi?.occupancy_rate),
      metricType: 'occupancy_rate' as MetricType,
      isReceipts: false,
      gradient: 'from-sky-500/10 to-blue-500/5',
      iconBg: 'bg-gradient-to-br from-sky-500 to-blue-600',
      iconColor: 'text-white',
      accentColor: 'border-l-sky-500/30',
      hoverShadow: 'hover:shadow-sky-500/20',
    },
    {
      label: 'Vacancy',
      value: formatPercent(activeKpi?.vacancy_rate),
      metricType: 'vacancy_rate' as MetricType,
      isReceipts: false,
      gradient: 'from-slate-500/10 to-gray-500/5',
      iconBg: 'bg-gradient-to-br from-slate-500 to-gray-600',
      iconColor: 'text-white',
      accentColor: 'border-l-slate-500/30',
      hoverShadow: 'hover:shadow-slate-500/20',
    },
    {
      label: 'Receipts',
      value: 'View All',
      metricType: 'expenses' as MetricType,
      isReceipts: true,
      gradient: 'from-amber-500/10 to-yellow-500/5',
      iconBg: 'bg-gradient-to-br from-amber-500 to-yellow-600',
      iconColor: 'text-white',
      accentColor: 'border-l-amber-500/30',
      hoverShadow: 'hover:shadow-amber-500/20',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8F6F2] relative">

      {/* Header */}
      <div className="bg-white border-b border-border shadow-sm relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4 animate-fade-in">
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
                <p className="text-sm text-muted-foreground">Member Portal</p>
                {/* Pulsing green dot */}
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-2 h-2 rounded-full animate-ping opacity-75" style={{ backgroundColor: '#6b9b7a' }}></div>
                  <div className="relative w-2 h-2 rounded-full" style={{ backgroundColor: '#6b9b7a' }}></div>
                </div>
              </div>
            </div>

            {/* Toggle Navigation & Logout */}
            <div className="flex items-center gap-3">
              {/* Admin Dashboard Button - Only for owners/managers */}
              {(userRole === 'owner' || userRole === 'manager') && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="border-border hover:bg-primary/5 hover:border-primary hover:scale-105 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 cursor-pointer"
                >
                  <Link href={`/admin/${orgId}`} className="flex items-center gap-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="mr-0.5">
                      <path d="M12 4.5v15m7.5-7.5h-15" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Admin
                  </Link>
                </Button>
              )}
              {/* Messages Button */}
              <Button
                asChild
                variant="outline"
                size="sm"
                className="relative border-border hover:bg-primary/5 hover:border-primary hover:scale-105 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 cursor-pointer"
              >
                <Link href={`/portal/${orgId}/messages`} className="flex items-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="mr-0.5">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  Messages
                  {unreadCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>
              </Button>
              <div className="flex items-center gap-2 bg-muted/30 rounded-lg p-1 border border-border">
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className={`transition-all duration-300 ${!isProfilePage ? 'bg-primary text-foreground font-medium shadow-sm hover:bg-primary/80' : 'text-foreground hover:bg-muted/50'}`}
                >
                  <Link href={`/portal/${orgId}`} className="flex items-center gap-2" prefetch={true}>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Dashboard
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className={`transition-all duration-300 ${isProfilePage ? 'bg-primary text-foreground font-medium shadow-sm hover:bg-primary/80' : 'text-foreground hover:bg-muted/50'}`}
                >
                  <Link href={`/portal/${orgId}/profile`} className="flex items-center gap-2" prefetch={true}>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Profile
                  </Link>
                </Button>
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
          </div>

          <Separator className="mt-1 mb-4 bg-border" />

          <div className="flex flex-wrap items-center gap-4 text-sm animate-slide-in pb-4">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-muted/30 rounded-lg p-1 border border-[#E1ECDB]">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setViewMode('monthly')}
                className={`h-7 px-3 text-xs font-medium transition-all cursor-pointer ${
                  viewMode === 'monthly'
                    ? 'bg-[#9db896] text-white shadow-sm hover:bg-[#9db896]/90'
                    : 'text-foreground hover:bg-muted/50'
                }`}
              >
                <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Monthly
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setViewMode('annual')}
                className={`h-7 px-3 text-xs font-medium transition-all cursor-pointer ${
                  viewMode === 'annual'
                    ? 'bg-[#9db896] text-white shadow-sm hover:bg-[#9db896]/90'
                    : 'text-foreground hover:bg-muted/50'
                }`}
              >
                <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Year to Date
              </Button>
            </div>

            {/* Property Selector */}
            {properties.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Property:</span>
                <Listbox value={selectedPropertyId || 'all'} onChange={handlePropertyChange} disabled={loadingPropertyKpi}>
                  <div className="relative">
                    <Listbox.Button className="relative w-44 cursor-pointer rounded-lg bg-background py-2 pl-3 pr-10 text-left shadow-md border border-border hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                      <span className="block truncate text-sm font-medium">
                        {selectedPropertyId
                          ? properties.find(p => p.id === selectedPropertyId)?.name || 'All Properties'
                          : 'All Properties'}
                      </span>
                      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                        <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                        </svg>
                      </span>
                    </Listbox.Button>
                    <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                      <Listbox.Options className="absolute right-0 mt-1 max-h-60 w-44 overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 border border-border dropdown-scrollbar dropdown-scrollbar dropdown-scrollbar">
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
                        {properties.map((property) => (
                          <Listbox.Option
                            key={property.id}
                            value={property.id}
                            className={({ active }) =>
                              `relative cursor-pointer select-none py-2 pl-3 pr-4 ${
                                active ? 'bg-primary/10 text-primary' : 'text-foreground'
                              }`
                            }
                          >
                            {({ selected }) => (
                              <span className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}>
                                {property.name}
                              </span>
                            )}
                          </Listbox.Option>
                        ))}
                      </Listbox.Options>
                    </Transition>
                  </div>
                </Listbox>
                {loadingPropertyKpi && (
                  <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                )}
              </div>
            )}

            {viewMode === 'monthly' && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Month:</span>
                <Listbox value={month} onChange={handleMonthChange}>
                  <div className="relative">
                    <Listbox.Button className="relative w-44 cursor-pointer rounded-lg bg-background py-2 pl-3 pr-10 text-left shadow-md border border-border hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all">
                      <span className="block truncate text-sm font-semibold">
                        {monthOptions.find(m => m.value === month)?.label || month}
                      </span>
                      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                        <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                        </svg>
                      </span>
                    </Listbox.Button>
                    <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                      <Listbox.Options className="absolute right-0 mt-1 max-h-60 w-44 overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 border border-border dropdown-scrollbar dropdown-scrollbar dropdown-scrollbar">
                        {monthOptions.map((m) => (
                          <Listbox.Option
                            key={m.value}
                            value={m.value}
                            className={({ active }) =>
                              `relative cursor-pointer select-none py-2 pl-3 pr-4 ${
                                active ? 'bg-primary/10 text-primary' : 'text-foreground'
                              }`
                            }
                          >
                            {({ selected }) => (
                              <span className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}>
                                {m.label}
                              </span>
                            )}
                          </Listbox.Option>
                        ))}
                      </Listbox.Options>
                    </Transition>
                  </div>
                </Listbox>
              </div>
            )}
            {viewMode === 'annual' && loadingAnnual && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                <span>Loading year-to-date data...</span>
              </div>
            )}
            {plan && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Plan:</span>
                <Badge className="bg-primary text-primary-foreground font-semibold capitalize hover:bg-primary/90">
                  {plan.tier} ({plan.percent}%)
                </Badge>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Personalized Greeting */}
        {userName && (
          <div className="mb-6 animate-fade-in">
            <h2 className="text-3xl font-bold text-foreground">
              Hi {userName},
            </h2>
          </div>
        )}

        {/* KPI Cards */}
        <div className="mb-8 animate-fade-in">
          <div className="mb-6">
            <button
              onClick={() => setIsPerformanceExpanded(!isPerformanceExpanded)}
              className="w-full flex items-center justify-between p-4 rounded-xl transition-all duration-500 cursor-pointer group relative overflow-hidden backdrop-blur-sm"
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
                  className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-12"
                  style={{
                    background: 'linear-gradient(135deg, #374151, #1f2937)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                  }}
                >
                  <svg className="w-6 h-6 text-white transition-all duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Performance Metrics</h2>
                  {viewMode === 'annual' && (
                    <Badge className="mt-1 bg-primary/20 text-foreground font-semibold capitalize hover:bg-primary/30 border-primary/30">
                      Year to Date {new Date().getFullYear()}
                    </Badge>
                  )}
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
                  {isPerformanceExpanded ? 'HIDE' : 'SHOW'}
                </span>
                <div className="relative w-5 h-5">
                  <svg
                    className={`absolute inset-0 transition-all duration-700 ${isPerformanceExpanded ? 'rotate-180 scale-110' : 'rotate-0'}`}
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
              className={`overflow-hidden ${isPerformanceExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
              style={{
                transition: 'max-height 1000ms cubic-bezier(0.4, 0, 0.2, 1), opacity 1000ms cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              {selectedProperty && (
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="outline" className="text-sm font-medium border-primary/30 bg-primary/5 text-black">
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    {selectedProperty.name}
                  </Badge>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-2 px-4 pt-4 pb-8">
                {metricCards.map((card, index) => (
              <div
                key={card.label}
                className={`relative transition-all duration-700 ease-in-out bg-white overflow-visible group animate-fade-in rounded-2xl ${
                  (card as any).isCalculated
                    ? 'cursor-default'
                    : 'cursor-pointer'
                }`}
                style={{
                  animationDelay: `${index * 50}ms`,
                  border: '1px solid #E5E7EB',
                  borderRadius: '1rem',
                  boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
                  transition: 'all 700ms cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onMouseEnter={(e) => {
                  if ((card as any).isCalculated) return;
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)';
                  // Fade out the left border
                  const borderDiv = e.currentTarget.querySelector('.accent-border') as HTMLElement;
                  if (borderDiv) borderDiv.style.opacity = '0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)';
                  // Fade in the left border
                  const borderDiv = e.currentTarget.querySelector('.accent-border') as HTMLElement;
                  if (borderDiv) borderDiv.style.opacity = '1';
                }}
                onClick={() => {
                  if ((card as any).isCalculated) return;
                  if (card.isReceipts) {
                    setShowReceiptsModal(true);
                  } else {
                    setActiveChart({ type: card.metricType, title: card.label });
                  }
                }}
              >
                {/* Left Accent Border */}
                <div
                  className={`accent-border absolute ${card.accentColor} transition-opacity duration-700 ease-in-out`}
                  style={{
                    left: '0',
                    top: '0',
                    bottom: '0',
                    width: '4px',
                    borderTopLeftRadius: '1rem',
                    borderBottomLeftRadius: '1rem',
                  }}
                ></div>

                {/* Gradient Background */}
                <div
                  className={`absolute bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-2xl`}
                  style={{
                    top: '0',
                    left: '0',
                    right: '0',
                    bottom: '0',
                  }}
                ></div>

                <CardContent className="relative p-6">
                  {/* Header with Icon */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <CardDescription className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-1">
                        {card.label}
                      </CardDescription>
                    </div>
                    <div className={`${card.iconBg} ${card.iconColor} p-3 rounded-xl shadow-lg transform transition-all duration-700 ease-in-out group-hover:scale-110 group-hover:rotate-6`}>
                      {getMetricIcon(card.metricType, card.isReceipts)}
                    </div>
                  </div>

                  {/* Value */}
                  <div className="mb-3">
                    <div className="text-3xl font-bold text-gray-900 tabular-nums tracking-tight">
                      {card.value}
                    </div>
                  </div>

                  {/* Footer Action */}
                  {!(card as any).isCalculated && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 transition-all duration-700 ease-in-out group-hover:text-gray-700 group-hover:gap-2.5">
                      <span>{card.isReceipts ? 'View Receipts' : 'View History'}</span>
                      <svg className="w-4 h-4 transition-transform duration-700 ease-in-out group-hover:translate-x-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>
                  )}
                  {(card as any).isCalculated && (
                    <div className="text-xs font-medium text-gray-400 italic">
                      Calculated Value
                    </div>
                  )}
                </CardContent>
              </div>
                ))}
              </div>
              {!activeKpi && (
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  💡 No data for {viewMode === 'annual' ? `year ${new Date().getFullYear()}` : month} yet{selectedProperty ? ` for ${selectedProperty.name}` : ''}. Values shown are default.
                </p>
              )}
              {viewMode === 'annual' && annualKpis.length > 0 && (
                <div className="mt-4 p-3 rounded-lg border border-[#E1ECDB] bg-[#E1ECDB]/10">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <svg className="w-4 h-4 text-[#9db896]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Showing totals from <strong>{annualKpis.length} month{annualKpis.length !== 1 ? 's' : ''}</strong> in {new Date().getFullYear()}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bookings */}
        <div className="mb-8 animate-fade-in" style={{ animationDelay: '500ms' }}>
          <button
            onClick={() => setIsBookingsExpanded(!isBookingsExpanded)}
            className="w-full flex items-center justify-between mb-6 p-4 rounded-xl transition-all duration-500 cursor-pointer group relative overflow-hidden backdrop-blur-sm"
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
                className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-12"
                style={{
                  background: 'linear-gradient(135deg, #374151, #1f2937)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                }}
              >
                <svg className="w-6 h-6 text-white transition-all duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Bookings</h2>
                {bookings.length > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/20 text-foreground">
                      {bookings.length} total
                    </span>
                  </div>
                )}
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
                {isBookingsExpanded ? 'HIDE' : 'SHOW'}
              </span>
              <div className="relative w-5 h-5">
                <svg
                  className={`absolute inset-0 transition-all duration-700 ${isBookingsExpanded ? 'rotate-180 scale-110' : 'rotate-0'}`}
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
            className={`overflow-hidden ${isBookingsExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}
            style={{
              transition: 'max-height 1000ms cubic-bezier(0.4, 0, 0.2, 1), opacity 1000ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
          <div className="flex items-center justify-between mb-6">
            {/* Status Filter */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Filter:</span>
              <Listbox value={bookingFilterStatus} onChange={setBookingFilterStatus}>
                <div className="relative">
                  <Listbox.Button className="relative w-44 cursor-pointer rounded-lg bg-background py-2 pl-3 pr-10 text-left shadow-md border border-border hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all">
                    <span className="block truncate text-sm">
                      {bookingFilterStatus === 'all' && 'All Bookings'}
                      {bookingFilterStatus === 'upcoming' && 'Upcoming'}
                      {bookingFilterStatus === 'completed' && 'Completed'}
                      {bookingFilterStatus === 'cancelled' && 'Cancelled'}
                    </span>
                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                      <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                      </svg>
                    </span>
                  </Listbox.Button>
                  <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                    <Listbox.Options className="absolute left-0 mt-1 max-h-60 w-44 overflow-auto rounded-md bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 border border-border">
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
                            All Bookings
                          </span>
                        )}
                      </Listbox.Option>
                      <Listbox.Option
                        value="upcoming"
                        className={({ active }) =>
                          `relative cursor-pointer select-none py-2 pl-3 pr-4 ${
                            active ? 'bg-primary/10 text-primary' : 'text-foreground'
                          }`
                        }
                      >
                        {({ selected }) => (
                          <span className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}>
                            Upcoming
                          </span>
                        )}
                      </Listbox.Option>
                      <Listbox.Option
                        value="completed"
                        className={({ active }) =>
                          `relative cursor-pointer select-none py-2 pl-3 pr-4 ${
                            active ? 'bg-primary/10 text-primary' : 'text-foreground'
                          }`
                        }
                      >
                        {({ selected }) => (
                          <span className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}>
                            Completed
                          </span>
                        )}
                      </Listbox.Option>
                      <Listbox.Option
                        value="cancelled"
                        className={({ active }) =>
                          `relative cursor-pointer select-none py-2 pl-3 pr-4 ${
                            active ? 'bg-primary/10 text-primary' : 'text-foreground'
                          }`
                        }
                      >
                        {({ selected }) => (
                          <span className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}>
                            Cancelled
                          </span>
                        )}
                      </Listbox.Option>
                    </Listbox.Options>
                  </Transition>
                </div>
              </Listbox>
            </div>
          </div>
          {bookings.length === 0 ? (
            <Card className="border-border bg-card shadow-sm">
              <CardContent className="py-8 text-center text-muted-foreground">
                No bookings yet for your properties.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {(() => {
                // Filter bookings by selected status
                const filteredBookings = bookingFilterStatus === 'all'
                  ? bookings
                  : bookings.filter(booking => booking.status === bookingFilterStatus);

                // Group bookings by status
                const groupedByStatus = {
                  upcoming: filteredBookings.filter(b => b.status === 'upcoming'),
                  completed: filteredBookings.filter(b => b.status === 'completed'),
                  cancelled: filteredBookings.filter(b => b.status === 'cancelled'),
                };

                return Object.entries(groupedByStatus).map(([status, statusBookings]) => {
                  if (statusBookings.length === 0) return null;

                  const statusConfig = {
                    upcoming: { color: 'bg-blue-100 text-blue-800 border-blue-300', icon: '📅', label: 'Upcoming' },
                    completed: { color: 'bg-green-100 text-green-800 border-green-300', icon: '✓', label: 'Completed' },
                    cancelled: { color: 'bg-red-100 text-red-800 border-red-300', icon: '✕', label: 'Cancelled' },
                  }[status as 'upcoming' | 'completed' | 'cancelled'];

                  const isExpanded = expandedBookingStatuses.has(status);

                  return (
                    <div key={status} className="border border-border/50 rounded-lg bg-gradient-to-r from-muted/20 to-muted/10">
                      {/* Status Header - Clickable */}
                      <button
                        onClick={() => toggleBookingStatusExpanded(status)}
                        className="w-full p-4 flex items-center justify-between hover:bg-muted/20 transition-colors cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-2">
                          <svg
                            className={`w-4 h-4 text-primary transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <Badge className={`${statusConfig.color} font-semibold`}>
                            {statusConfig.icon} {statusConfig.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {statusBookings.length} booking{statusBookings.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </button>

                      {/* Bookings for this status - Collapsible */}
                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-2">
                          {statusBookings.map((booking) => {
                            const checkIn = new Date(booking.check_in);
                            const checkOut = new Date(booking.check_out);
                            const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

                            return (
                              <Card key={booking.id} className="group hover:shadow-md transition-all duration-200 border-border/50 bg-card">
                                <div className="p-4">
                                  <div className="flex items-start justify-between gap-4">
                                    {/* Left: Property & Dates */}
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-2">
                                        <svg className="w-5 h-5 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                        </svg>
                                        <h3 className="text-base font-semibold text-foreground">
                                          {booking.properties?.name || 'Unknown Property'}
                                        </h3>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                          <p className="text-xs text-muted-foreground mb-0.5">Check-in</p>
                                          <p className="font-medium text-foreground">
                                            {checkIn.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-muted-foreground mb-0.5">Check-out</p>
                                          <p className="font-medium text-foreground">
                                            {checkOut.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                          </p>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Right: Nights Badge */}
                                    <div className="text-right">
                                      <Badge variant="outline" className="bg-primary/10 border-primary/30 text-foreground font-bold text-base px-3 py-1">
                                        {nights} {nights === 1 ? 'Night' : 'Nights'}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }).filter(Boolean);
              })()}
            </div>
          )}
          </div>
        </div>

        {/* Reviews Section */}
        <div className="mb-8 animate-fade-in">
          <div className="mb-6">
            <button
              onClick={() => setIsReviewsExpanded(!isReviewsExpanded)}
              className="w-full flex items-center justify-between p-4 rounded-xl transition-all duration-500 cursor-pointer group relative overflow-hidden backdrop-blur-sm"
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
                  className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-12"
                  style={{
                    background: 'linear-gradient(135deg, #374151, #1f2937)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                  }}
                >
                  <svg className="w-6 h-6 text-white transition-all duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-foreground">Reviews</h2>
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
                  {isReviewsExpanded ? 'HIDE' : 'SHOW'}
                </span>
                <div className="relative w-5 h-5">
                  <svg
                    className={`absolute inset-0 transition-all duration-700 ${isReviewsExpanded ? 'rotate-180 scale-110' : 'rotate-0'}`}
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
          </div>

          <div
            className={`overflow-hidden ${isReviewsExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}
            style={{
              transition: 'max-height 1000ms cubic-bezier(0.4, 0, 0.2, 1), opacity 1000ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <div className="space-y-4">
              {loadingReviews ? (
                <Card className="shadow-md animate-fade-in" style={{ border: '1px solid #E1ECDB' }}>
                  <CardContent className="py-8">
                    <div className="text-center text-muted-foreground">Loading reviews...</div>
                  </CardContent>
                </Card>
              ) : reviews.length === 0 ? (
                <Card className="shadow-md animate-fade-in" style={{ border: '1px solid #E1ECDB' }}>
                  <CardContent className="py-8">
                    <div className="text-center text-muted-foreground">No reviews yet</div>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Calculate average ratings */}
                  {(() => {
                    // Filter reviews by selected property and month
                    let filteredReviews = reviews;

                    // Filter by selected property if one is selected
                    if (selectedPropertyId) {
                      filteredReviews = filteredReviews.filter(r => r.property_id === selectedPropertyId);
                    }

                    // Filter by month (reviews from that month)
                    if (month) {
                      filteredReviews = filteredReviews.filter(r => {
                        const reviewMonth = r.review_date.slice(0, 7); // YYYY-MM
                        return reviewMonth === month.slice(0, 7); // YYYY-MM
                      });
                    }

                    const airbnbReviews = filteredReviews.filter(r => r.platform === 'airbnb');
                    const vrboReviews = filteredReviews.filter(r => r.platform === 'vrbo');

                    const avgAirbnb = airbnbReviews.length > 0
                      ? (airbnbReviews.reduce((sum, r) => sum + r.rating, 0) / airbnbReviews.length).toFixed(1)
                      : null;

                    const avgVrbo = vrboReviews.length > 0
                      ? (vrboReviews.reduce((sum, r) => sum + r.rating, 0) / vrboReviews.length).toFixed(1)
                      : null;

                    // If no reviews match the filters, show a message
                    if (filteredReviews.length === 0) {
                      return (
                        <Card className="shadow-md animate-fade-in" style={{ border: '1px solid #E1ECDB' }}>
                          <CardContent className="py-8">
                            <div className="text-center text-muted-foreground">
                              No reviews found for {selectedPropertyId ? 'this property' : 'this month'}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    }

                    return (
                      <>
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                          <Card className="shadow-md hover:shadow-lg transition-shadow animate-fade-in" style={{ border: '2px solid #E1ECDB' }}>
                            <CardContent className="pt-6">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-muted-foreground">Total Reviews</span>
                                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                </svg>
                              </div>
                              <div className="text-4xl font-bold text-primary">{filteredReviews.length}</div>
                            </CardContent>
                          </Card>

                          {avgAirbnb && (
                            <Card className="shadow-md hover:shadow-lg transition-shadow animate-fade-in" style={{ border: '2px solid #E1ECDB' }}>
                              <CardContent className="pt-6">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-muted-foreground">Airbnb Avg</span>
                                  <img src="/airbnb-logo.png" alt="Airbnb" className="h-5 w-auto" />
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-4xl font-bold text-primary">{avgAirbnb}</div>
                                  <span className="text-lg text-muted-foreground">/ 5</span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">{airbnbReviews.length} reviews</div>
                              </CardContent>
                            </Card>
                          )}

                          {avgVrbo && (
                            <Card className="shadow-md hover:shadow-lg transition-shadow animate-fade-in" style={{ border: '2px solid #E1ECDB' }}>
                              <CardContent className="pt-6">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-muted-foreground">VRBO Avg</span>
                                  <img src="/vrbo-logo.png" alt="VRBO" className="h-6 w-auto" />
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-4xl font-bold text-primary">{avgVrbo}</div>
                                  <span className="text-lg text-muted-foreground">/ 10</span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">{vrboReviews.length} reviews</div>
                              </CardContent>
                            </Card>
                          )}
                        </div>

                        {/* Reviews List */}
                        <div className="space-y-3">
                          {filteredReviews.map((review) => (
                            <Card key={review.id} className="shadow-md hover:shadow-lg transition-shadow animate-fade-in" style={{ border: '1px solid #E1ECDB' }}>
                              <CardContent className="pt-6">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    <Badge className="capitalize bg-primary/10 text-foreground border-primary/20 hover:bg-primary/20 transition-colors duration-300">
                                      {review.properties?.name || 'Unknown Property'}
                                    </Badge>
                                    <img
                                      src={review.platform === 'airbnb' ? '/airbnb-logo.png' : '/vrbo-logo.png'}
                                      alt={review.platform === 'airbnb' ? 'Airbnb' : 'VRBO'}
                                      className={review.platform === 'airbnb' ? 'h-5 w-auto' : 'h-6 w-auto'}
                                    />
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <svg className="w-5 h-5 text-yellow-500 fill-current" viewBox="0 0 24 24">
                                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                    </svg>
                                    <span className="text-xl font-bold text-foreground">
                                      {review.rating}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                      / {review.platform === 'airbnb' ? '5' : '10'}
                                    </span>
                                  </div>
                                </div>

                                <div className="text-sm text-muted-foreground mb-2">
                                  {new Date(review.review_date).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })}
                                </div>

                                {review.review_text && (
                                  <p className="text-sm text-foreground mt-3 p-3 bg-muted/30 rounded-lg border border-border">
                                    {review.review_text}
                                  </p>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Revenue & Expenses */}
        <div className="mb-8 animate-fade-in" style={{ animationDelay: '400ms' }}>
          <button
            onClick={() => setIsRevenueExpanded(!isRevenueExpanded)}
            className="w-full flex items-center justify-between mb-6 p-4 rounded-xl transition-all duration-500 cursor-pointer group relative overflow-hidden backdrop-blur-sm"
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
                className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-12"
                style={{
                  background: 'linear-gradient(135deg, #374151, #1f2937)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                }}
              >
                <svg className="w-6 h-6 text-white transition-all duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Revenue & Expenses</h2>
                {ledgerEntries.length > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/20 text-foreground">
                      {ledgerEntries.length} entries
                    </span>
                  </div>
                )}
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
                {isRevenueExpanded ? 'HIDE' : 'SHOW'}
              </span>
              <div className="relative w-5 h-5">
                <svg
                  className={`absolute inset-0 transition-all duration-700 ${isRevenueExpanded ? 'rotate-180 scale-110' : 'rotate-0'}`}
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

          {/* Month Filter - Outside collapsible to prevent clipping */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Filter:</span>
              <Listbox value={ledgerFilterMonth} onChange={setLedgerFilterMonth}>
                <div className="relative">
                  <Listbox.Button className="relative w-44 cursor-pointer rounded-lg bg-background py-2 pl-3 pr-10 text-left shadow-md border border-border hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all">
                    <span className="block truncate text-sm">
                      {ledgerFilterMonth === 'all' ? 'All Months' : (() => {
                        const [year, monthNum] = ledgerFilterMonth.split('-').map(Number);
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
                                `relative cursor-pointer select-none py-2 pl-3 pr-4 ${
                                  active ? 'bg-primary/10 text-primary' : 'text-foreground'
                                }`
                              }
                            >
                              {({ selected }) => (
                                <span className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}>
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
          </div>

          {/* Collapsible content */}
          <div
            className={`overflow-hidden ${isRevenueExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
            style={{
              transition: 'max-height 1000ms cubic-bezier(0.4, 0, 0.2, 1), opacity 1000ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
          {ledgerEntries.length === 0 ? (
            <Card className="border-border bg-card shadow-sm">
              <CardContent className="py-8 text-center text-muted-foreground">
                No revenue or expense entries yet for your properties.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {(() => {
                // Filter entries by selected month
                const filteredEntries = ledgerFilterMonth === 'all'
                  ? ledgerEntries
                  : ledgerEntries.filter(entry => entry.entry_date?.slice(0, 7) === ledgerFilterMonth);

                // Group entries by month
                const grouped = filteredEntries.reduce((acc: Record<string, any[]>, entry) => {
                  const month = entry.entry_date?.slice(0, 7) || 'no-date'; // YYYY-MM
                  if (!acc[month]) acc[month] = [];
                  acc[month].push(entry);
                  return acc;
                }, {});

                return Object.entries(grouped).map(([month, entries]) => {
                  // Parse YYYY-MM to avoid timezone issues
                  const [year, monthNum] = month.split('-').map(Number);
                  const monthLabel = new Date(year, monthNum - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                  const totalRevenue = entries.filter(e => e.amount_cents > 0).reduce((sum, e) => sum + e.amount_cents, 0);
                  const totalExpenses = entries.filter(e => e.amount_cents < 0).reduce((sum, e) => sum + Math.abs(e.amount_cents), 0);

                  const isExpanded = expandedMonths.has(month);

                  return (
                    <div key={month} className="border border-border/50 rounded-lg bg-gradient-to-r from-muted/20 to-muted/10">
                      {/* Month Header - Clickable */}
                      <button
                        onClick={() => toggleMonthExpanded(month)}
                        className="w-full p-4 flex items-center justify-between hover:bg-muted/20 transition-colors cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-2">
                          <svg
                            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            style={{ color: '#9db896' }}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <svg className="w-4 h-4 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <h4 className="text-sm font-semibold text-foreground">
                            {monthLabel}
                          </h4>
                          <Badge variant="outline" className="text-xs">{entries.length}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-green-600 font-medium">+${(totalRevenue / 100).toFixed(2)}</span>
                          <span className="text-red-600 font-medium">-${(totalExpenses / 100).toFixed(2)}</span>
                        </div>
                      </button>

                      {/* Entries for this month - Collapsible */}
                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-2">
                        {entries.map((entry) => {
                          const isRevenue = entry.amount_cents > 0;
                          return (
                            <Card key={entry.id} className="group hover:shadow-md transition-all duration-200 border-border/50 bg-card">
                              <div className="p-3 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 flex-1">
                                  {/* Icon */}
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                    isRevenue ? 'bg-green-100' : 'bg-red-100'
                                  }`}>
                                    <svg className={`w-4 h-4 ${isRevenue ? 'text-green-600' : 'text-red-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      {isRevenue ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                      )}
                                    </svg>
                                  </div>

                                  {/* Details */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <p className="text-sm font-medium text-foreground">{entry.description || 'No description'}</p>
                                      <Badge className={`text-xs ${
                                        isRevenue ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'
                                      }`}>
                                        {isRevenue ? 'Revenue' : 'Expense'}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <span>{entry.properties?.name || 'Unknown'}</span>
                                      <span>•</span>
                                      <span>{new Date(entry.entry_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
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
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          )}
          </div>
        </div>

        {/* Invoices */}
        <div className="mb-8 animate-fade-in" style={{ animationDelay: '300ms' }}>
          <button
            onClick={() => setIsInvoicesExpanded(!isInvoicesExpanded)}
            className="w-full flex items-center justify-between mb-6 p-4 rounded-xl transition-all duration-500 cursor-pointer group relative overflow-hidden backdrop-blur-sm"
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
                className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-12"
                style={{
                  background: 'linear-gradient(135deg, #374151, #1f2937)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                }}
              >
                <svg className="w-6 h-6 text-white transition-all duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Invoices</h2>
                {invoices.length > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/20 text-foreground">
                      {invoices.length} total
                    </span>
                  </div>
                )}
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
                {isInvoicesExpanded ? 'HIDE' : 'SHOW'}
              </span>
              <div className="relative w-5 h-5">
                <svg
                  className={`absolute inset-0 transition-all duration-700 ${isInvoicesExpanded ? 'rotate-180 scale-110' : 'rotate-0'}`}
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

          {/* Month Filter - Outside collapsible to prevent clipping */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Filter:</span>
              <Listbox value={invoiceFilterMonth} onChange={setInvoiceFilterMonth}>
                <div className="relative">
                  <Listbox.Button className="relative w-44 cursor-pointer rounded-lg bg-background py-2 pl-3 pr-10 text-left shadow-md border border-border hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all">
                    <span className="block truncate text-sm">
                      {invoiceFilterMonth === 'all' ? 'All Months' : (() => {
                        const [year, monthNum] = invoiceFilterMonth.split('-').map(Number);
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
                            All Months
                          </span>
                        )}
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
                            <Listbox.Option
                              key={month}
                              value={month}
                              className={({ active }) =>
                                `relative cursor-pointer select-none py-2 pl-3 pr-4 ${
                                  active ? 'bg-primary/10 text-primary' : 'text-foreground'
                                }`
                              }
                            >
                              {({ selected }) => (
                                <span className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}>
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
          </div>

          {/* Collapsible content */}
          <div
            className={`overflow-hidden ${isInvoicesExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
            style={{
              transition: 'max-height 1000ms cubic-bezier(0.4, 0, 0.2, 1), opacity 1000ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
          {invoices.length === 0 ? (
            <Card className="border-border bg-card shadow-sm">
              <CardContent className="py-8 text-center text-muted-foreground">
                No invoices yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {(() => {
                // Filter invoices by selected month
                const filteredInvoices = invoiceFilterMonth === 'all'
                  ? invoices
                  : invoices.filter(invoice => invoice.bill_month?.slice(0, 7) === invoiceFilterMonth);

                // Group invoices by month
                const grouped = filteredInvoices.reduce((acc: Record<string, any[]>, invoice) => {
                  const month = invoice.bill_month?.slice(0, 7) || 'no-date'; // YYYY-MM
                  if (!acc[month]) acc[month] = [];
                  acc[month].push(invoice);
                  return acc;
                }, {});

                return Object.entries(grouped).map(([month, monthInvoices]) => {
                  // Parse YYYY-MM to avoid timezone issues
                  const [year, monthNum] = month.split('-').map(Number);
                  const monthLabel = new Date(year, monthNum - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                  const paidCount = monthInvoices.filter(i => i.status === 'paid').length;
                  const totalDue = monthInvoices.reduce((sum, i) => sum + (i.amount_due_cents || 0), 0);

                  const isExpanded = expandedInvoiceMonths.has(month);

                  return (
                    <div key={month} className="border border-border/50 rounded-lg bg-gradient-to-r from-muted/20 to-muted/10">
                      {/* Month Header - Clickable */}
                      <button
                        onClick={() => toggleInvoiceMonthExpanded(month)}
                        className="w-full p-4 flex items-center justify-between hover:bg-muted/20 transition-colors cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-2">
                          <svg
                            className={`w-4 h-4 text-primary transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <h4 className="text-sm font-semibold text-foreground">
                            {monthLabel}
                          </h4>
                          <Badge variant="outline" className="text-xs">{monthInvoices.length}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-muted-foreground">{paidCount} paid / {monthInvoices.length} total</span>
                          <span className="font-medium">${(totalDue / 100).toFixed(2)}</span>
                        </div>
                      </button>

                      {/* Invoices for this month - Collapsible */}
                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-2">
                          {monthInvoices.map((inv) => (
                            <Card key={inv.id} className="group hover:shadow-md transition-all duration-200 border-border/50 bg-card">
                              <div className="p-3">
                                {/* Header Row */}
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <p className="text-sm font-medium text-foreground">
                                      Invoice #{inv.invoice_number ?? inv.id.slice(0, 8)}
                                    </p>
                                  </div>
                                  <Badge
                                    variant={
                                      inv.status === 'paid'
                                        ? 'default'
                                        : inv.status === 'void'
                                        ? 'destructive'
                                        : 'secondary'
                                    }
                                    className={
                                      inv.status === 'paid'
                                        ? 'bg-green-100 text-green-800 border-green-300'
                                        : inv.status === 'void'
                                        ? ''
                                        : 'bg-red-100 text-red-800 border-red-300'
                                    }
                                  >
                                    {inv.status === 'paid' ? 'PAID' : inv.status === 'void' ? 'VOID' : 'DUE'}
                                  </Badge>
                                </div>

                                {/* Details Row */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>{inv.bill_month}</span>
                                  </div>
                                  <p className="text-base font-bold text-foreground">
                                    {formatMoney(inv.amount_due_cents)}
                                  </p>
                                </div>

                                {/* Actions Row */}
                                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                                  <Button variant="link" size="sm" asChild className="h-auto p-0 text-primary hover:text-primary/80 cursor-pointer text-xs">
                                    <a href={`/api/invoices/${inv.id}/pdf`} className="cursor-pointer">View PDF</a>
                                  </Button>
                                  <span className="text-muted-foreground">•</span>
                                  <Button variant="link" size="sm" asChild className="h-auto p-0 text-primary hover:text-primary/80 cursor-pointer text-xs">
                                    <a href={`/api/invoices/${inv.id}/pdf-link`} className="cursor-pointer">Get Link</a>
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          )}
          </div>
        </div>


        <Card className="border-dashed bg-muted/20 animate-fade-in" style={{ animationDelay: '600ms', borderColor: '#E1ECDB' }}>
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              🏡 <strong>Welcome to TruHost!</strong> Managing your short-term rental properties made simple.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Questions? Reach out to info@truhost.ca
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart Modal */}
      {activeChart && (
        <MetricChart
          orgId={orgId}
          metricType={activeChart.type}
          title={activeChart.title}
          onClose={() => setActiveChart(null)}
        />
      )}

      {/* Receipts Modal */}
      {showReceiptsModal && (
        <ReceiptsModal
          orgId={orgId}
          month={month}
          properties={properties}
          selectedPropertyId={selectedPropertyId}
          isAdmin={false}
          onClose={() => setShowReceiptsModal(false)}
        />
      )}
    </div>
  );
}
