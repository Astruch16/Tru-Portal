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

  // Generate month options (last 12 months)
  const generateMonthOptions = () => {
    const months = [];
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStr = date.toISOString().slice(0, 7);
      months.push(monthStr);
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

  // Calculate plan fees based on gross revenue and plan percentage
  const planFeesInCents = plan && displayKpi ? Math.floor((displayKpi.gross_revenue_cents * plan.percent) / 100) : 0;

  const metricCards = [
    {
      label: 'Gross Revenue',
      value: formatMoney(displayKpi?.gross_revenue_cents),
      metricType: 'gross_revenue' as MetricType,
      icon: '💰',
      isReceipts: false,
    },
    {
      label: 'Expenses',
      value: formatMoney(displayKpi?.expenses_cents),
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
    },
    {
      label: 'Net Revenue',
      value: formatMoney(displayKpi?.net_revenue_cents),
      metricType: 'net_revenue' as MetricType,
      icon: '📈',
      isReceipts: false,
    },
    {
      label: 'Nights Booked',
      value: formatNumber(displayKpi?.nights_booked),
      metricType: 'nights_booked' as MetricType,
      icon: '🏠',
      isReceipts: false,
    },
    {
      label: 'Occupancy',
      value: formatPercent(displayKpi?.occupancy_rate),
      metricType: 'occupancy_rate' as MetricType,
      icon: '📊',
      isReceipts: false,
    },
    {
      label: 'Vacancy',
      value: formatPercent(displayKpi?.vacancy_rate),
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
    <div className="min-h-screen bg-gradient-to-br from-[#F8F6F2] via-[#E1ECDB]/20 to-[#E1ECDB]/40 relative">
      {/* Geometric pattern overlay */}
      <div className="fixed inset-0 opacity-[0.15] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23E1ECDB' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        backgroundSize: '60px 60px'
      }}></div>

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

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Month:</span>
              <select
                value={month}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="h-8 rounded-md border border-border bg-background px-3 text-sm font-semibold tabular-nums shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 hover:border-primary/50 cursor-pointer"
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
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
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Performance Metrics
            </h2>
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
                className="cursor-pointer transition-all duration-500 ease-in-out hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/3 hover:border-primary/20 bg-card overflow-hidden group animate-fade-in"
                style={{
                  animationDelay: `${index * 50}ms`,
                  border: '1px solid #E1ECDB',
                  transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                onClick={() => {
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
                  <div className="flex items-center gap-1 text-xs text-primary font-medium transition-all duration-500 ease-in-out group-hover:gap-1.5">
                    <span>{card.isReceipts ? 'View Receipts' : 'View History'}</span>
                    <svg className="w-3 h-3 transition-transform duration-500 ease-in-out group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {!displayKpi && (
            <p className="text-sm text-muted-foreground mt-4 text-center">
              💡 No data for {month} yet{selectedProperty ? ` for ${selectedProperty.name}` : ''}. Values shown are default.
            </p>
          )}
        </div>

        {/* Invoices */}
        <div className="mb-8 animate-fade-in" style={{ animationDelay: '300ms' }}>
          <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
            <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Invoices
          </h2>
          <Card className="border-border bg-card shadow-sm">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Invoice #</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Month</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Amount</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 px-4 text-center text-muted-foreground">
                        No invoices for {month}
                      </td>
                    </tr>
                  )}
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-sm">
                        {inv.invoice_number ?? inv.id.slice(0, 8)}
                      </td>
                      <td className="py-3 px-4 text-sm">{inv.bill_month}</td>
                      <td className="py-3 px-4 text-right font-semibold tabular-nums">{formatMoney(inv.amount_due_cents)}</td>
                      <td className="py-3 px-4">
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
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Button variant="link" size="sm" asChild className="h-auto p-0 text-[#E1ECDB] hover:text-[#C4D4BA] cursor-pointer">
                            <a href={`/api/invoices/${inv.id}/pdf`} className="cursor-pointer">PDF</a>
                          </Button>
                          <span className="text-muted-foreground">•</span>
                          <Button variant="link" size="sm" asChild className="h-auto p-0 text-[#E1ECDB] hover:text-[#C4D4BA] cursor-pointer">
                            <a href={`/api/invoices/${inv.id}/pdf-link`} className="cursor-pointer">Link</a>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-border">
              {invoices.length === 0 && (
                <div className="py-8 px-4 text-center text-muted-foreground">
                  No invoices for {month}
                </div>
              )}
              {invoices.map((inv) => (
                <div key={inv.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Invoice #</p>
                      <p className="font-mono text-sm font-semibold">
                        {inv.invoice_number ?? inv.id.slice(0, 8)}
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
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Month</p>
                      <p className="text-sm">{inv.bill_month}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Amount</p>
                      <p className="text-sm font-semibold tabular-nums">{formatMoney(inv.amount_due_cents)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="default" size="sm" asChild className="flex-1 cursor-pointer">
                      <a href={`/api/invoices/${inv.id}/pdf`} className="cursor-pointer">View PDF</a>
                    </Button>
                    <Button variant="outline" size="sm" asChild className="flex-1 cursor-pointer">
                      <a href={`/api/invoices/${inv.id}/pdf-link`} className="cursor-pointer">Get Link</a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="border-dashed bg-muted/20 animate-fade-in" style={{ animationDelay: '400ms', borderColor: '#E1ECDB' }}>
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
