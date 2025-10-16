'use client';

import { useState, useEffect } from 'react';
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

interface PortalClientProps {
  orgId: string;
  month: string;
  kpi: KPI | null;
  invoices: Invoice[];
  plan: Plan | null;
  properties: Property[];
}

export default function PortalClient({ orgId, month, kpi, invoices, plan, properties }: PortalClientProps) {
  console.log('PortalClient - Plan received:', plan);
  const pathname = usePathname();
  const router = useRouter();
  const isProfilePage = pathname?.includes('/profile');
  const sb = supabaseClient();

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

  // Fetch ledger entries
  const fetchLedgerEntries = async () => {
    try {
      const response = await fetch(`/api/orgs/${orgId}/ledger`);
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

  // Fetch ledger entries on mount
  useEffect(() => {
    fetchLedgerEntries();
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

  const metricCards = [
    {
      label: 'Gross Revenue',
      value: formatMoney(activeKpi?.gross_revenue_cents),
      metricType: 'gross_revenue' as MetricType,
      icon: '💰',
      isReceipts: false,
    },
    {
      label: 'Expenses',
      value: formatMoney(activeKpi?.expenses_cents),
      metricType: 'expenses' as MetricType,
      icon: '💸',
      isReceipts: false,
    },
    {
      label: `TruHost Fees (${plan?.percent || 0}%)`,
      value: formatMoney(planFeesInCents),
      metricType: 'expenses' as MetricType,
      icon: '🏢',
      isReceipts: false,
      isCalculated: true, // This is a calculated value, not clickable
    },
    {
      label: 'Net Revenue',
      value: formatMoney(activeKpi?.net_revenue_cents),
      metricType: 'net_revenue' as MetricType,
      icon: '📈',
      isReceipts: false,
    },
    {
      label: 'Nights Booked',
      value: formatNumber(activeKpi?.nights_booked),
      metricType: 'nights_booked' as MetricType,
      icon: '🏠',
      isReceipts: false,
    },
    {
      label: 'Occupancy',
      value: formatPercent(activeKpi?.occupancy_rate),
      metricType: 'occupancy_rate' as MetricType,
      icon: '📊',
      isReceipts: false,
    },
    {
      label: 'Vacancy',
      value: formatPercent(activeKpi?.vacancy_rate),
      metricType: 'vacancy_rate' as MetricType,
      icon: '📉',
      isReceipts: false,
    },
    {
      label: 'Receipts',
      value: 'View All',
      metricType: 'expenses' as MetricType,
      icon: '📄',
      isReceipts: true,
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
                className={`h-7 px-3 text-xs font-medium transition-all ${
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
                className={`h-7 px-3 text-xs font-medium transition-all ${
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
                <select
                  value={selectedPropertyId || 'all'}
                  onChange={(e) => handlePropertyChange(e.target.value)}
                  className="h-8 rounded-md border border-border bg-background px-3 text-sm shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 hover:border-primary/50 cursor-pointer font-medium"
                  disabled={loadingPropertyKpi}
                >
                  <option value="all">All Properties</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
                {loadingPropertyKpi && (
                  <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                )}
              </div>
            )}

            {viewMode === 'monthly' && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Month:</span>
                <select
                  value={month}
                  onChange={(e) => handleMonthChange(e.target.value)}
                  className="h-8 rounded-md border border-border bg-background px-3 text-sm font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 hover:border-primary/50 cursor-pointer"
                >
                  {monthOptions.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
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
        {/* KPI Cards */}
        <div className="mb-8 animate-fade-in">
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Performance Metrics
              </h2>
              {viewMode === 'annual' && (
                <Badge className="bg-primary text-primary-foreground font-semibold capitalize hover:bg-primary/90">
                  Year to Date {new Date().getFullYear()}
                </Badge>
              )}
            </div>
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
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {metricCards.map((card, index) => (
              <Card
                key={card.label}
                className={`transition-all duration-500 ease-in-out bg-card overflow-hidden group animate-fade-in ${
                  (card as any).isCalculated
                    ? 'cursor-default'
                    : 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/3 hover:border-primary/20'
                }`}
                style={{
                  animationDelay: `${index * 50}ms`,
                  border: '1px solid #E1ECDB',
                  transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                onClick={() => {
                  if ((card as any).isCalculated) return; // Don't open chart for calculated values
                  if (card.isReceipts) {
                    setShowReceiptsModal(true);
                  } else {
                    setActiveChart({ type: card.metricType, title: card.label });
                  }
                }}
              >
                <CardHeader className="pb-3">
                  <CardDescription className="text-muted-foreground font-medium transition-colors duration-500 ease-in-out group-hover:text-foreground">
                    {card.label}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold text-foreground mb-2 tabular-nums tracking-tight">
                    {card.value}
                  </div>
                  {!(card as any).isCalculated && (
                    <div className="flex items-center gap-1 text-xs text-primary font-medium transition-all duration-500 ease-in-out group-hover:gap-1.5">
                      <span>{card.isReceipts ? 'View Receipts' : 'View History'}</span>
                      <svg className="w-3 h-3 transition-transform duration-500 ease-in-out group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  )}
                  {(card as any).isCalculated && (
                    <div className="text-xs text-muted-foreground">
                      Calculated Value
                    </div>
                  )}
                </CardContent>
              </Card>
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

        {/* Invoices */}
        <div className="mb-8 animate-fade-in" style={{ animationDelay: '300ms' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Invoices
              {invoices.length > 0 && (
                <Badge variant="outline" className="ml-2 bg-primary/5 border-primary/30 text-black">
                  {invoices.length}
                </Badge>
              )}
            </h2>
            {/* Month Filter */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Filter:</span>
              <select
                value={invoiceFilterMonth}
                onChange={(e) => setInvoiceFilterMonth(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-3 text-sm shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 hover:border-primary/50 cursor-pointer"
              >
                <option value="all">All Months</option>
                {(() => {
                  const months = new Set<string>();
                  invoices.forEach(invoice => {
                    const month = invoice.bill_month?.slice(0, 7);
                    if (month) months.add(month);
                  });
                  return Array.from(months).sort().reverse().map(month => {
                    const [year, monthNum] = month.split('-').map(Number);
                    const label = new Date(year, monthNum - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                    return <option key={month} value={month}>{label}</option>;
                  });
                })()}
              </select>
            </div>
          </div>
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

        {/* Revenue & Expenses */}
        <div className="mb-8 animate-fade-in" style={{ animationDelay: '400ms' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Revenue & Expenses
              {ledgerEntries.length > 0 && (
                <Badge variant="outline" className="ml-2 bg-primary/5 border-primary/30 text-black">
                  {ledgerEntries.length}
                </Badge>
              )}
            </h2>
            {/* Month Filter */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Filter:</span>
              <select
                value={ledgerFilterMonth}
                onChange={(e) => setLedgerFilterMonth(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-3 text-sm shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 hover:border-primary/50 cursor-pointer"
              >
                <option value="all">All Months</option>
                {(() => {
                  const months = new Set<string>();
                  ledgerEntries.forEach(entry => {
                    const month = entry.entry_date?.slice(0, 7);
                    if (month) months.add(month);
                  });
                  return Array.from(months).sort().reverse().map(month => {
                    const [year, monthNum] = month.split('-').map(Number);
                    const label = new Date(year, monthNum - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                    return <option key={month} value={month}>{label}</option>;
                  });
                })()}
              </select>
            </div>
          </div>
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

        <Card className="border-dashed bg-muted/20 animate-fade-in" style={{ animationDelay: '500ms', borderColor: '#E1ECDB' }}>
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
