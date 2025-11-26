'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from 'recharts';
import { format } from 'date-fns';
import { formatMoney, formatNumber, formatPercent } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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

type MetricType =
  | 'gross_revenue'
  | 'net_revenue'
  | 'expenses'
  | 'occupancy_rate'
  | 'vacancy_rate'
  | 'nights_booked';

type ViewMode = 'monthly' | 'annual';

interface MetricChartProps {
  orgId: string;
  metricType: MetricType;
  title: string;
  onClose: () => void;
}

const METRIC_CONFIG: Record<
  MetricType,
  {
    label: string;
    color: string;
    gradientStart: string;
    gradientEnd: string;
    headerGradient: string;
    accentColor: string;
    chartColor: string;
    chartColorDark: string;
    iconPath: string;
    format: (value: number) => string;
    dataKey: keyof KPI;
  }
> = {
  gross_revenue: {
    label: 'Gross Revenue',
    color: '#10b981',
    gradientStart: '#10b981',
    gradientEnd: '#059669',
    headerGradient: 'linear-gradient(to right, #10b981, #059669)',
    accentColor: '#10b981',
    chartColor: '#10b981',
    chartColorDark: '#059669',
    iconPath: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    format: (val) => formatMoney(val),
    dataKey: 'gross_revenue_cents',
  },
  net_revenue: {
    label: 'Net Revenue',
    color: '#10b981',
    gradientStart: '#10b981',
    gradientEnd: '#14b8a6',
    headerGradient: 'linear-gradient(to right, #10b981, #14b8a6)',
    accentColor: '#10b981',
    chartColor: '#10b981',
    chartColorDark: '#14b8a6',
    iconPath: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
    format: (val) => formatMoney(val),
    dataKey: 'net_revenue_cents',
  },
  expenses: {
    label: 'Expenses',
    color: '#f97316',
    gradientStart: '#f97316',
    gradientEnd: '#dc2626',
    headerGradient: 'linear-gradient(to right, #f97316, #dc2626)',
    accentColor: '#f97316',
    chartColor: '#f97316',
    chartColorDark: '#dc2626',
    iconPath: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
    format: (val) => formatMoney(val),
    dataKey: 'expenses_cents',
  },
  occupancy_rate: {
    label: 'Occupancy Rate',
    color: '#0ea5e9',
    gradientStart: '#0ea5e9',
    gradientEnd: '#2563eb',
    headerGradient: 'linear-gradient(to right, #0ea5e9, #2563eb)',
    accentColor: '#0ea5e9',
    chartColor: '#0ea5e9',
    chartColorDark: '#2563eb',
    iconPath: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    format: (val) => formatPercent(val),
    dataKey: 'occupancy_rate',
  },
  vacancy_rate: {
    label: 'Vacancy Rate',
    color: '#64748b',
    gradientStart: '#64748b',
    gradientEnd: '#6b7280',
    headerGradient: 'linear-gradient(to right, #64748b, #6b7280)',
    accentColor: '#64748b',
    chartColor: '#64748b',
    chartColorDark: '#6b7280',
    iconPath: 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6',
    format: (val) => formatPercent(val),
    dataKey: 'vacancy_rate',
  },
  nights_booked: {
    label: 'Nights Booked',
    color: '#3b82f6',
    gradientStart: '#3b82f6',
    gradientEnd: '#06b6d4',
    headerGradient: 'linear-gradient(to right, #3b82f6, #06b6d4)',
    accentColor: '#3b82f6',
    chartColor: '#3b82f6',
    chartColorDark: '#06b6d4',
    iconPath: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    format: (val) => formatNumber(val),
    dataKey: 'nights_booked',
  },
};

type LedgerEntry = {
  id: string;
  entry_date: string;
  amount_cents: number;
  category: string;
  properties?: { name: string };
};

type Booking = {
  id: string;
  check_in: string;
  check_out: string;
  status: string;
  properties?: { name: string };
};

export default function MetricChart({ orgId, metricType, title, onClose }: MetricChartProps) {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [monthlyEntries, setMonthlyEntries] = useState<LedgerEntry[]>([]);
  const [monthlyBookings, setMonthlyBookings] = useState<Booking[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [isBreakdownExpanded, setIsBreakdownExpanded] = useState(true);
  const [sortOrder, setSortOrder] = useState<'chronological' | 'peak' | 'low'>('chronological');
  const [isEntriesExpanded, setIsEntriesExpanded] = useState(true);
  const [entryTypeFilter, setEntryTypeFilter] = useState<'all' | 'revenue' | 'expenses'>('all');
  const [isMobile, setIsMobile] = useState(false);

  const config = METRIC_CONFIG[metricType];

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, []);

  useEffect(() => {
    async function fetchHistory() {
      try {
        setLoading(true);

        // Get authenticated user session
        const { supabaseClient } = await import('@/lib/supabase/client');
        const sb = supabaseClient();
        const { data: { session } } = await sb.auth.getSession();

        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const res = await fetch(`/api/orgs/${orgId}/kpis/history?months=12`, { headers });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch historical data');
        }

        // Sort by month ascending (oldest first) for proper chart display
        const sortedKpis = (data.kpis || []).reverse();
        setKpis(sortedKpis);

        // Set initial selected month to the most recent
        if (sortedKpis.length > 0) {
          setSelectedMonth(sortedKpis[sortedKpis.length - 1].month);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [orgId]);

  // Fetch entries for selected month
  useEffect(() => {
    async function fetchMonthlyEntries() {
      if (!selectedMonth) return;

      setLoadingEntries(true);
      try {
        // Fetch ledger entries for revenue/expenses
        if (metricType === 'gross_revenue' || metricType === 'expenses' || metricType === 'net_revenue') {
          // Get authenticated user session
          const { supabaseClient } = await import('@/lib/supabase/client');
          const sb = supabaseClient();
          const { data: { session } } = await sb.auth.getSession();

          const headers: HeadersInit = { 'Content-Type': 'application/json' };
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
          }

          const response = await fetch(`/api/orgs/${orgId}/ledger`, { headers });
          const data = await response.json();

          if (data.ok && data.entries) {
            // Filter entries for the selected month
            const filtered = data.entries.filter((entry: LedgerEntry) => {
              const entryMonth = entry.entry_date.slice(0, 7) + '-01';
              return entryMonth === selectedMonth;
            });
            setMonthlyEntries(filtered);
          }
        }

        // Fetch bookings for nights_booked/occupancy/vacancy
        if (metricType === 'nights_booked' || metricType === 'occupancy_rate' || metricType === 'vacancy_rate') {
          // Get authenticated user
          const { supabaseClient } = await import('@/lib/supabase/client');
          const sb = supabaseClient();
          const { data: { session } } = await sb.auth.getSession();

          if (session) {
            const headers: HeadersInit = { 'Content-Type': 'application/json' };
            if (session?.access_token) {
              headers['Authorization'] = `Bearer ${session.access_token}`;
            }

            // Fetch bookings with auth (API will filter by user's properties)
            const response = await fetch(`/api/orgs/${orgId}/bookings`, { headers });
            const data = await response.json();

            if (data.ok && data.bookings) {
              // Filter bookings for selected month and completed status
              const filtered = data.bookings.filter((booking: any) => {
                const bookingMonth = booking.check_in.slice(0, 7) + '-01';
                return bookingMonth === selectedMonth && booking.status === 'completed';
              });
              setMonthlyBookings(filtered);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching monthly entries:', err);
      } finally {
        setLoadingEntries(false);
      }
    }

    if (viewMode === 'monthly' && selectedMonth) {
      fetchMonthlyEntries();
    }
  }, [selectedMonth, orgId, metricType, viewMode]);

  // Transform data for the chart (fix timezone issue)
  const chartData = kpis.map((kpi) => {
    // Parse YYYY-MM-DD without timezone conversion
    const [year, monthNum] = kpi.month.split('-').map(Number);
    const date = new Date(year, monthNum - 1, 1);

    return {
      month: format(date, 'MMM yyyy'),
      monthKey: kpi.month,
      value: kpi[config.dataKey] as number,
    };
  });

  // Calculate annual total/average
  const annualData = viewMode === 'annual' ? {
    total: kpis.reduce((sum, kpi) => sum + (kpi[config.dataKey] as number), 0),
    average: kpis.length > 0
      ? kpis.reduce((sum, kpi) => sum + (kpi[config.dataKey] as number), 0) / kpis.length
      : 0,
    months: kpis.length,
  } : null;

  // Get selected month data
  const selectedKpi = kpis.find(k => k.month === selectedMonth);
  const selectedValue = selectedKpi ? (selectedKpi[config.dataKey] as number) : 0;

  // Create daily breakdown chart data for monthly view
  const dailyChartData = (() => {
    if (viewMode !== 'monthly' || !selectedMonth) return [];

    const [year, monthNum] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const dailyData: { day: number; date: string; value: number; entries: any[] }[] = [];

    // Initialize all days with 0
    for (let day = 1; day <= daysInMonth; day++) {
      dailyData.push({
        day,
        date: `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        value: 0,
        entries: []
      });
    }

    // Populate with actual data
    if (metricType === 'gross_revenue' || metricType === 'expenses' || metricType === 'net_revenue') {
      monthlyEntries.forEach(entry => {
        const [, , dayStr] = entry.entry_date.split('-');
        const day = parseInt(dayStr, 10);
        const dayIndex = day - 1;

        if (dailyData[dayIndex]) {
          const amount = Math.abs(entry.amount_cents);

          // For gross_revenue: only positive amounts
          if (metricType === 'gross_revenue' && entry.amount_cents > 0) {
            dailyData[dayIndex].value += amount;
            dailyData[dayIndex].entries.push(entry);
          }
          // For expenses: only negative amounts
          else if (metricType === 'expenses' && entry.amount_cents < 0) {
            dailyData[dayIndex].value += amount;
            dailyData[dayIndex].entries.push(entry);
          }
          // For net_revenue: all amounts (positive - negative)
          else if (metricType === 'net_revenue') {
            dailyData[dayIndex].value += entry.amount_cents;
            dailyData[dayIndex].entries.push(entry);
          }
        }
      });
    } else if (metricType === 'nights_booked') {
      monthlyBookings.forEach(booking => {
        const [, , dayStr] = booking.check_in.split('-');
        const day = parseInt(dayStr, 10);
        const dayIndex = day - 1;

        if (dailyData[dayIndex]) {
          const checkIn = new Date(booking.check_in);
          const checkOut = new Date(booking.check_out);
          const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

          dailyData[dayIndex].value += nights;
          dailyData[dayIndex].entries.push(booking);
        }
      });
    } else if (metricType === 'occupancy_rate' || metricType === 'vacancy_rate') {
      // For occupancy/vacancy, mark each day a property was occupied
      const [year, monthNum] = selectedMonth.split('-').map(Number);
      const daysInMonth = new Date(year, monthNum, 0).getDate();

      // Get number of properties from user_properties
      const numProperties = monthlyBookings.length > 0 ?
        new Set(monthlyBookings.map(b => (b as any).property_id)).size : 1;

      // Mark occupied days for each booking
      monthlyBookings.forEach(booking => {
        const checkIn = new Date(booking.check_in);
        const checkOut = new Date(booking.check_out);

        // Mark each day in the booking range as occupied
        let currentDate = new Date(checkIn);
        while (currentDate < checkOut) {
          const day = currentDate.getDate();
          const dayIndex = day - 1;

          if (dailyData[dayIndex]) {
            dailyData[dayIndex].value += (1 / numProperties); // Add occupancy per property
            dailyData[dayIndex].entries.push(booking);
          }

          currentDate.setDate(currentDate.getDate() + 1);
        }
      });

      // Convert to percentage and handle vacancy rate
      dailyData.forEach(dayData => {
        if (metricType === 'vacancy_rate') {
          dayData.value = 1 - Math.min(dayData.value, 1);
        } else {
          dayData.value = Math.min(dayData.value, 1);
        }
      });
    }

    return dailyData;
  })();

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in duration-200"
      onClick={onClose}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className="bg-[#F8F6F2] rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] sm:max-h-[90vh] overflow-auto animate-in zoom-in-95 duration-200 modal-scrollbar"
        style={{
          border: '2px solid #E1ECDB',
          scrollbarGutter: 'stable'
        }}
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => {
          const target = e.currentTarget;
          const atTop = target.scrollTop === 0;
          const atBottom = target.scrollHeight - target.scrollTop === target.clientHeight;

          if ((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0)) {
            e.preventDefault();
          }
        }}
      >
        {/* Header */}
        <div className="sticky top-0 text-white px-3 sm:px-6 py-3 sm:py-5 rounded-t-xl sm:rounded-t-2xl border-b border-white/20 z-10" style={{ background: config.headerGradient, backgroundColor: config.accentColor }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center">
                <svg className="w-5 h-5 sm:w-7 sm:h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={config.iconPath} />
                </svg>
              </div>
              <div>
                <h2 className="text-lg sm:text-2xl font-bold truncate">{config.label}</h2>
                <p className="text-white/90 text-xs sm:text-sm mt-0.5 hidden sm:block">
                  {viewMode === 'monthly' ? 'Monthly Performance Analysis' : 'Annual Performance Overview'}
                </p>
              </div>
            </div>
            <Button
              onClick={onClose}
              variant="ghost"
              className="text-white hover:bg-white/20 transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
          {loading && (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#9db896] border-t-transparent"></div>
              <p className="text-gray-600 mt-4">Loading analytics...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-700">
              <strong>Error:</strong> {error}
            </div>
          )}

          {!loading && !error && chartData.length === 0 && (
            <div className="text-center py-20 text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-lg">No historical data available yet</p>
            </div>
          )}

          {!loading && !error && chartData.length > 0 && (
            <>
              {/* View Mode Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                <div className="flex gap-2">
                  <Button
                    onClick={() => setViewMode('monthly')}
                    variant={viewMode === 'monthly' ? 'default' : 'outline'}
                    className={`transition-all cursor-pointer ${viewMode === 'monthly' ? 'text-white' : 'hover:bg-gray-100'}`}
                    style={viewMode === 'monthly' ? { background: config.accentColor } : {}}
                  >
                    <svg className="w-4 h-4 sm:mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="hidden sm:inline">Monthly View</span><span className="sm:hidden">Month</span>
                  </Button>
                  <Button
                    onClick={() => setViewMode('annual')}
                    variant={viewMode === 'annual' ? 'default' : 'outline'}
                    className={`transition-all cursor-pointer ${viewMode === 'annual' ? 'text-white' : 'hover:bg-gray-100'}`}
                    style={viewMode === 'annual' ? { background: config.accentColor } : {}}
                  >
                    <svg className="w-4 h-4 sm:mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span className="hidden sm:inline">Annual View</span><span className="sm:hidden">Year</span>
                  </Button>
                </div>

                {viewMode === 'monthly' ? (
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 transition-all cursor-pointer"
                    style={{
                      borderColor: 'rgb(209 213 219)',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = config.accentColor;
                      e.target.style.boxShadow = `0 0 0 3px ${config.accentColor}20`;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgb(209 213 219)';
                      e.target.style.boxShadow = 'none';
                    }}
                    onMouseEnter={(e) => {
                      if (document.activeElement !== e.target) {
                        e.target.style.borderColor = config.accentColor;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (document.activeElement !== e.target) {
                        e.target.style.borderColor = 'rgb(209 213 219)';
                      }
                    }}
                  >
                    {kpis.map((kpi) => {
                      // Parse YYYY-MM-DD without timezone conversion
                      const [year, monthNum] = kpi.month.split('-').map(Number);
                      const date = new Date(year, monthNum - 1, 1);
                      return (
                        <option key={kpi.month} value={kpi.month}>
                          {format(date, 'MMMM yyyy')}
                        </option>
                      );
                    })}
                  </select>
                ) : null}
              </div>

              {/* Featured Metric Card */}
              <Card className="shadow-lg bg-white" style={{ border: `2px solid ${config.accentColor}` }}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${config.accentColor}20` }}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: config.accentColor }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={config.iconPath} />
                      </svg>
                    </div>
                    {viewMode === 'monthly' ? 'Selected Month' : 'Annual Summary'}
                  </CardTitle>
                  <CardDescription>
                    {viewMode === 'monthly'
                      ? selectedMonth ? (() => {
                          const [year, monthNum] = selectedMonth.split('-').map(Number);
                          return format(new Date(year, monthNum - 1, 1), 'MMMM yyyy');
                        })() : 'Select a month'
                      : `Last ${kpis.length} months`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl sm:text-5xl font-bold mb-2" style={{ color: config.chartColorDark }}>
                    {viewMode === 'monthly'
                      ? config.format(selectedValue)
                      : (metricType === 'occupancy_rate' || metricType === 'vacancy_rate')
                        ? config.format(annualData?.average || 0)
                        : config.format(annualData?.total || 0)}
                  </div>
                  {viewMode === 'annual' && metricType !== 'occupancy_rate' && metricType !== 'vacancy_rate' && (
                    <div className="text-sm text-gray-600">
                      Average per month: <strong>{config.format(annualData?.average || 0)}</strong>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Chart */}
              <Card className="shadow-lg bg-white" style={{ border: '1px solid #E1ECDB' }}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: config.accentColor }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                    {viewMode === 'monthly' ? 'Daily Breakdown' : 'Performance Trend'}
                  </CardTitle>
                  <CardDescription>
                    {viewMode === 'monthly' ? 'Individual entries by day of month' : 'Historical data visualization'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingEntries && viewMode === 'monthly' ? (
                    <div className="text-center py-20">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#9db896] border-t-transparent"></div>
                      <p className="text-gray-600 mt-4 text-sm">Loading daily data...</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={isMobile ? 250 : 350}>
                      {viewMode === 'monthly' ? (
                        <LineChart data={dailyChartData} margin={isMobile ? { top: 10, right: 10, left: 0, bottom: 20 } : { top: 20, right: 40, left: 30, bottom: 50 }}>
                          <defs>
                            <linearGradient id={`gradient-monthly-${metricType}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={config.chartColor} stopOpacity={0.4} />
                              <stop offset="95%" stopColor={config.chartColor} stopOpacity={0.02} />
                            </linearGradient>
                            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                              <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
                              <feOffset dx="0" dy="2" result="offsetblur"/>
                              <feComponentTransfer>
                                <feFuncA type="linear" slope="0.2"/>
                              </feComponentTransfer>
                              <feMerge>
                                <feMergeNode/>
                                <feMergeNode in="SourceGraphic"/>
                              </feMerge>
                            </filter>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="0"
                            stroke="#E1ECDB"
                            opacity={0.6}
                            vertical={false}
                            strokeWidth={1.5}
                          />
                          <XAxis
                            dataKey="day"
                            stroke={config.chartColorDark}
                            strokeWidth={isMobile ? 1 : 2}
                            style={{ fontSize: isMobile ? 10 : 14, fontWeight: 600, fill: '#374151' }}
                            tick={{ fill: '#374151', fontWeight: 600, fontSize: isMobile ? 10 : 14 }}
                            axisLine={{ stroke: config.chartColor, strokeWidth: isMobile ? 1 : 2 }}
                            tickLine={{ stroke: config.chartColor, strokeWidth: isMobile ? 1 : 1.5 }}
                            interval={isMobile ? 4 : 'preserveStartEnd'}
                            label={isMobile ? undefined : {
                              value: 'Day of Month',
                              position: 'insideBottom',
                              offset: -15,
                              style: { fontSize: 15, fontWeight: 800, fill: '#1f2937', letterSpacing: '0.5px' }
                            }}
                          />
                          <YAxis
                            stroke={config.chartColorDark}
                            strokeWidth={isMobile ? 1 : 2}
                            style={{ fontSize: isMobile ? 10 : 14, fontWeight: 600, fill: '#374151' }}
                            tick={{ fill: '#374151', fontWeight: 600, fontSize: isMobile ? 10 : 14 }}
                            axisLine={{ stroke: config.chartColor, strokeWidth: isMobile ? 1 : 2 }}
                            tickLine={{ stroke: config.chartColor, strokeWidth: isMobile ? 1 : 1.5 }}
                            width={isMobile ? 35 : 60}
                            label={isMobile ? undefined : {
                              value: config.dataKey.includes('cents') ? 'Amount ($)' : 'Value',
                              angle: -90,
                              position: 'insideLeft',
                              style: { fontSize: 15, fontWeight: 800, fill: '#1f2937', letterSpacing: '0.5px' }
                            }}
                            tickFormatter={(value) => {
                              if (config.dataKey.includes('cents')) {
                                const dollars = value / 100;
                                if (dollars >= 1000) return `$${(dollars / 1000).toFixed(0)}k`;
                                return `$${dollars.toFixed(0)}`;
                              }
                              if (config.dataKey.includes('rate')) {
                                return `${(value * 100).toFixed(0)}%`;
                              }
                              return value.toString();
                            }}
                          />
                          <Tooltip
                            contentStyle={{
                              background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
                              border: `2px solid ${config.chartColor}`,
                              borderRadius: 16,
                              padding: 20,
                              boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.15), 0 10px 10px -5px rgb(0 0 0 / 0.08)',
                            }}
                            labelStyle={{ fontSize: 14, fontWeight: 700, color: config.chartColorDark, marginBottom: 8 }}
                            cursor={{ stroke: config.chartColor, strokeWidth: 2, strokeDasharray: '5 5', opacity: 0.5 }}
                            labelFormatter={(day) => `Day ${day}`}
                            formatter={(value: number, name, props) => {
                              const entries = props.payload.entries || [];
                              return [
                                <div key="tooltip">
                                  <div className="font-bold mb-1 text-lg" style={{ color: config.chartColorDark }}>{config.format(value)}</div>
                                  {entries.length > 0 && (
                                    <div className="text-xs text-gray-600 font-medium">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</div>
                                  )}
                                </div>,
                                config.label
                              ];
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke={config.chartColor}
                            strokeWidth={isMobile ? 2 : 4}
                            fill={`url(#gradient-monthly-${metricType})`}
                            dot={isMobile ? false : {
                              fill: '#ffffff',
                              r: 6,
                              strokeWidth: 3,
                              stroke: config.chartColor,
                              filter: 'url(#shadow)'
                            }}
                            activeDot={{
                              r: isMobile ? 5 : 8,
                              strokeWidth: isMobile ? 2 : 4,
                              stroke: config.chartColorDark,
                              fill: '#ffffff',
                              filter: isMobile ? undefined : 'url(#shadow)'
                            }}
                            animationDuration={1500}
                            animationEasing="ease-in-out"
                          />
                        </LineChart>
                      ) : (
                        <AreaChart data={chartData} margin={isMobile ? { top: 10, right: 10, left: 0, bottom: 30 } : { top: 20, right: 40, left: 30, bottom: 50 }}>
                          <defs>
                            <linearGradient id={`gradient-annual-${metricType}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={config.chartColor} stopOpacity={0.5} />
                              <stop offset="95%" stopColor={config.chartColor} stopOpacity={0.02} />
                            </linearGradient>
                            <filter id="shadow-annual" x="-50%" y="-50%" width="200%" height="200%">
                              <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
                              <feOffset dx="0" dy="2" result="offsetblur"/>
                              <feComponentTransfer>
                                <feFuncA type="linear" slope="0.2"/>
                              </feComponentTransfer>
                              <feMerge>
                                <feMergeNode/>
                                <feMergeNode in="SourceGraphic"/>
                              </feMerge>
                            </filter>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="0"
                            stroke="#E1ECDB"
                            opacity={0.6}
                            vertical={false}
                            strokeWidth={1.5}
                          />
                          <XAxis
                            dataKey="month"
                            stroke={config.chartColorDark}
                            strokeWidth={isMobile ? 1 : 2}
                            style={{ fontSize: isMobile ? 9 : 13, fontWeight: 600, fill: '#374151' }}
                            tick={{ fill: '#374151', fontWeight: 600, fontSize: isMobile ? 9 : 13 }}
                            axisLine={{ stroke: config.chartColor, strokeWidth: isMobile ? 1 : 2 }}
                            tickLine={{ stroke: config.chartColor, strokeWidth: isMobile ? 1 : 1.5 }}
                            angle={isMobile ? -60 : -45}
                            textAnchor="end"
                            height={isMobile ? 50 : 80}
                            interval={isMobile ? 1 : 0}
                            label={isMobile ? undefined : {
                              value: 'Month',
                              position: 'insideBottom',
                              offset: -25,
                              style: { fontSize: 15, fontWeight: 800, fill: '#1f2937', letterSpacing: '0.5px' }
                            }}
                          />
                          <YAxis
                            stroke={config.chartColorDark}
                            strokeWidth={isMobile ? 1 : 2}
                            style={{ fontSize: isMobile ? 10 : 14, fontWeight: 600, fill: '#374151' }}
                            tick={{ fill: '#374151', fontWeight: 600, fontSize: isMobile ? 10 : 14 }}
                            axisLine={{ stroke: config.chartColor, strokeWidth: isMobile ? 1 : 2 }}
                            tickLine={{ stroke: config.chartColor, strokeWidth: isMobile ? 1 : 1.5 }}
                            width={isMobile ? 35 : 60}
                            label={isMobile ? undefined : {
                              value: config.dataKey.includes('cents') ? 'Amount ($)' : 'Value',
                              angle: -90,
                              position: 'insideLeft',
                              style: { fontSize: 15, fontWeight: 800, fill: '#1f2937', letterSpacing: '0.5px' }
                            }}
                            tickFormatter={(value) => {
                              if (config.dataKey.includes('cents')) {
                                const dollars = value / 100;
                                if (dollars >= 1000) return `$${(dollars / 1000).toFixed(0)}k`;
                                return `$${dollars.toFixed(0)}`;
                              }
                              if (config.dataKey.includes('rate')) {
                                return `${(value * 100).toFixed(0)}%`;
                              }
                              return value.toString();
                            }}
                          />
                          <Tooltip
                            contentStyle={{
                              background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
                              border: `2px solid ${config.chartColor}`,
                              borderRadius: 16,
                              padding: 20,
                              boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.15), 0 10px 10px -5px rgb(0 0 0 / 0.08)',
                            }}
                            labelStyle={{ fontSize: 14, fontWeight: 700, color: config.chartColorDark, marginBottom: 8 }}
                            cursor={{ stroke: config.chartColor, strokeWidth: 2, strokeDasharray: '5 5', opacity: 0.5 }}
                            formatter={(value: number) => [
                              <div key="tooltip" className="font-bold text-lg" style={{ color: config.chartColorDark }}>
                                {config.format(value)}
                              </div>,
                              config.label
                            ]}
                          />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke={config.chartColor}
                            strokeWidth={isMobile ? 2 : 4}
                            fill={`url(#gradient-annual-${metricType})`}
                            dot={isMobile ? {
                              fill: '#ffffff',
                              r: 3,
                              strokeWidth: 2,
                              stroke: config.chartColor
                            } : {
                              fill: '#ffffff',
                              r: 6,
                              strokeWidth: 3,
                              stroke: config.chartColor,
                              filter: 'url(#shadow-annual)'
                            }}
                            activeDot={{
                              r: isMobile ? 5 : 8,
                              strokeWidth: isMobile ? 2 : 4,
                              stroke: config.chartColorDark,
                              fill: '#ffffff',
                              filter: isMobile ? undefined : 'url(#shadow-annual)'
                            }}
                            animationDuration={1500}
                            animationEasing="ease-in-out"
                          />
                        </AreaChart>
                      )}
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Individual Entries List (Monthly View Only) */}
              {viewMode === 'monthly' && (monthlyEntries.length > 0 || monthlyBookings.length > 0) && (
                <Card className="shadow-lg bg-white" style={{ border: '1px solid #E1ECDB' }}>
                  {/* Header - Always Visible */}
                  <button
                    onClick={() => setIsEntriesExpanded(!isEntriesExpanded)}
                    className={`w-full text-left cursor-pointer group relative overflow-hidden rounded-t-lg ${!isEntriesExpanded ? 'rounded-b-lg' : ''} transition-all duration-500 backdrop-blur-sm`}
                    style={{
                      background: `linear-gradient(135deg, ${config.accentColor}05 0%, transparent 100%)`,
                      borderBottom: isEntriesExpanded ? `2px solid ${config.accentColor}20` : 'none',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = `linear-gradient(135deg, ${config.accentColor}15 0%, ${config.accentColor}05 100%)`;
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = `0 8px 16px -4px ${config.accentColor}30`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = `linear-gradient(135deg, ${config.accentColor}05 0%, transparent 100%)`;
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {/* Animated gradient border overlay */}
                    <div
                      className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                      style={{
                        background: `linear-gradient(90deg, ${config.accentColor}00, ${config.accentColor}40, ${config.accentColor}00)`,
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 3s infinite',
                        pointerEvents: 'none',
                      }}
                    />
                    <CardHeader
                      className="relative cursor-pointer"
                    >

                      <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-12"
                            style={{
                              background: `linear-gradient(135deg, ${config.accentColor}20, ${config.accentColor}40)`,
                              boxShadow: `0 4px 12px ${config.accentColor}30`,
                            }}
                          >
                            <svg className="w-5 h-5 transition-all duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: config.accentColor }}>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                          </div>
                          <div>
                            <CardTitle className="flex items-center gap-2 text-base font-bold">
                              All Entries This Month
                            </CardTitle>
                            <CardDescription className="flex items-center gap-2 mt-1">
                              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold transition-all duration-300" style={{ backgroundColor: `${config.accentColor}20`, color: config.chartColorDark }}>
                                {monthlyEntries.length + monthlyBookings.length} {monthlyEntries.length + monthlyBookings.length === 1 ? 'entry' : 'entries'}
                              </span>
                            </CardDescription>
                          </div>
                        </div>
                        <div
                          className="flex items-center gap-3 px-4 py-2.5 rounded-xl backdrop-blur-md transition-all duration-500 group-hover:scale-105"
                          style={{
                            background: `linear-gradient(135deg, ${config.accentColor}15, ${config.accentColor}25)`,
                            border: `1px solid ${config.accentColor}40`,
                            boxShadow: `0 4px 12px ${config.accentColor}20`,
                          }}
                        >
                          <span className="text-xs font-bold tracking-wide" style={{ color: config.chartColorDark }}>
                            {isEntriesExpanded ? 'HIDE' : 'SHOW'}
                          </span>
                          <div className="relative w-5 h-5">
                            <svg
                              className={`absolute inset-0 transition-all duration-700 ${isEntriesExpanded ? 'rotate-180 scale-110' : 'rotate-0'}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              style={{ color: config.accentColor }}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                  </button>

                  {/* Add shimmer keyframe animation */}
                  <style jsx>{`
                    @keyframes shimmer {
                      0% { background-position: -200% 0; }
                      100% { background-position: 200% 0; }
                    }
                  `}</style>

                  {/* Content - Collapsible */}
                  <div
                    className={`overflow-hidden rounded-b-lg ${isEntriesExpanded ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'}`}
                    style={{
                      transition: 'max-height 1000ms cubic-bezier(0.4, 0, 0.2, 1), opacity 1000ms cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    {/* Type Filter Buttons (Only for revenue/expense metrics) */}
                    {(metricType === 'gross_revenue' || metricType === 'expenses' || metricType === 'net_revenue') && (
                      <div className="px-6 py-4 border-t border-[#E1ECDB]">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground font-medium text-sm mr-2">Filter Type:</span>
                          <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg border border-[#E1ECDB]">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEntryTypeFilter('all')}
                              className={`h-7 px-3 text-xs font-medium transition-all cursor-pointer ${
                                entryTypeFilter === 'all'
                                  ? 'bg-[#9db896] text-white shadow-sm hover:bg-[#9db896]/90'
                                  : 'text-foreground hover:bg-muted/50'
                              }`}
                            >
                              All
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEntryTypeFilter('revenue')}
                              className={`h-7 px-3 text-xs font-medium transition-all cursor-pointer ${
                                entryTypeFilter === 'revenue'
                                  ? 'bg-green-600 text-white shadow-sm hover:bg-green-600/90'
                                  : 'text-foreground hover:bg-muted/50'
                              }`}
                            >
                              Revenue
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEntryTypeFilter('expenses')}
                              className={`h-7 px-3 text-xs font-medium transition-all cursor-pointer ${
                                entryTypeFilter === 'expenses'
                                  ? 'bg-red-600 text-white shadow-sm hover:bg-red-600/90'
                                  : 'text-foreground hover:bg-muted/50'
                              }`}
                            >
                              Expenses
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    <CardContent className="pt-6">
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                      {/* Ledger Entries */}
                      {(() => {
                        // Apply type filter
                        let filteredEntries = monthlyEntries;
                        if (entryTypeFilter === 'revenue') {
                          filteredEntries = monthlyEntries.filter(e => e.amount_cents > 0);
                        } else if (entryTypeFilter === 'expenses') {
                          filteredEntries = monthlyEntries.filter(e => e.amount_cents < 0);
                        }

                        return filteredEntries.sort((a, b) => a.entry_date.localeCompare(b.entry_date)).map((entry) => {
                          // Parse date without timezone conversion (keep in PST/local)
                          const [year, month, day] = entry.entry_date.split('-').map(Number);
                          const date = new Date(year, month - 1, day);
                          const isRevenue = entry.amount_cents > 0;

                          return (
                            <div
                              key={entry.id}
                              className="flex items-center justify-between p-3 bg-[#F8F6F2] hover:bg-[#E1ECDB]/20 rounded-lg transition-colors"
                              style={{ border: '1px solid #E1ECDB' }}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isRevenue ? 'bg-green-100' : 'bg-red-100'}`}>
                                  <svg className={`w-5 h-5 ${isRevenue ? 'text-green-700' : 'text-red-700'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    {isRevenue ? (
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    ) : (
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                    )}
                                  </svg>
                                </div>
                                <div>
                                  <div className="font-semibold text-gray-900">{entry.category || (isRevenue ? 'Revenue' : 'Expense')}</div>
                                  <div className="text-xs text-gray-600">
                                    Day {day} - {format(date, 'MMM d, yyyy')}
                                    {entry.properties?.name && ` • ${entry.properties.name}`}
                                  </div>
                                </div>
                              </div>
                              <div className={`text-lg font-bold ${isRevenue ? 'text-green-700' : 'text-red-700'}`}>
                                {isRevenue ? '+' : '-'}${(Math.abs(entry.amount_cents) / 100).toFixed(2)}
                              </div>
                            </div>
                          );
                        });
                      })()}

                      {/* Bookings */}
                      {monthlyBookings.sort((a, b) => a.check_in.localeCompare(b.check_in)).map((booking) => {
                        // Parse dates without timezone conversion (keep in PST/local)
                        const [year, month, day] = booking.check_in.split('-').map(Number);
                        const checkInDate = new Date(year, month - 1, day);

                        const [yearOut, monthOut, dayOut] = booking.check_out.split('-').map(Number);
                        const checkOutDate = new Date(yearOut, monthOut - 1, dayOut);

                        const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

                        return (
                          <div
                            key={booking.id}
                            className="flex items-center justify-between p-3 bg-[#F8F6F2] hover:bg-[#E1ECDB]/20 rounded-lg transition-colors"
                            style={{ border: '1px solid #E1ECDB' }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-[#E1ECDB]/30 flex items-center justify-center">
                                <svg className="w-5 h-5 text-[#88a882]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900">Booking</div>
                                <div className="text-xs text-gray-600">
                                  {format(checkInDate, 'MMM d')} - {format(checkOutDate, 'MMM d, yyyy')}
                                  {booking.properties?.name && ` • ${booking.properties.name}`}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-[#88a882]">{nights} {nights === 1 ? 'night' : 'nights'}</div>
                              <Badge variant="secondary" className="mt-1 bg-[#E1ECDB]/30 text-[#88a882] border-[#E1ECDB] text-xs">
                                {booking.status}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </div>
              </Card>
            )}

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                <Card className="bg-white shadow-md hover:shadow-lg transition-shadow" style={{ border: '1px solid #E1ECDB' }}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${config.accentColor}20` }}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: config.accentColor }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Latest</div>
                    </div>
                    <div className="text-lg sm:text-2xl font-bold" style={{ color: config.chartColorDark }}>
                      {config.format(chartData[chartData.length - 1]?.value || 0)}
                    </div>
                    <Badge variant="secondary" className="mt-2 border" style={{ backgroundColor: `${config.accentColor}20`, color: config.chartColorDark, borderColor: `${config.accentColor}40` }}>Most Recent</Badge>
                  </CardContent>
                </Card>

                <Card className="bg-white shadow-md hover:shadow-lg transition-shadow" style={{ border: '1px solid #E1ECDB' }}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${config.accentColor}20` }}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: config.accentColor }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Average</div>
                    </div>
                    <div className="text-lg sm:text-2xl font-bold" style={{ color: config.chartColorDark }}>
                      {config.format(
                        chartData.reduce((sum, d) => sum + d.value, 0) / chartData.length || 0
                      )}
                    </div>
                    <Badge variant="secondary" className="mt-2 border" style={{ backgroundColor: `${config.accentColor}20`, color: config.chartColorDark, borderColor: `${config.accentColor}40` }}>Mean Value</Badge>
                  </CardContent>
                </Card>

                <Card className="bg-white shadow-md hover:shadow-lg transition-shadow" style={{ border: '1px solid #10b981' }}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                        <svg className="w-4 h-4 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <div className="text-xs font-medium text-green-700 uppercase tracking-wide">Peak</div>
                    </div>
                    <div className="text-2xl font-bold text-green-700">
                      {config.format(Math.max(...chartData.map((d) => d.value)))}
                    </div>
                    <Badge variant="secondary" className="mt-2 bg-green-100 text-green-700 border-green-200">Best Month</Badge>
                  </CardContent>
                </Card>

                <Card className="bg-white shadow-md hover:shadow-lg transition-shadow" style={{ border: '1px solid #f59e0b' }}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                        <svg className="w-4 h-4 text-orange-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                        </svg>
                      </div>
                      <div className="text-xs font-medium text-orange-700 uppercase tracking-wide">Lowest</div>
                    </div>
                    <div className="text-2xl font-bold text-orange-700">
                      {config.format(Math.min(...chartData.map((d) => d.value)))}
                    </div>
                    <Badge variant="secondary" className="mt-2 bg-orange-100 text-orange-700 border-orange-200">Minimum</Badge>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Monthly Breakdown */}
              {viewMode === 'annual' && (
                <Card className="shadow-lg bg-white" style={{ border: '1px solid #E1ECDB' }}>
                  {/* Header - Always Visible */}
                  <button
                    onClick={() => setIsBreakdownExpanded(!isBreakdownExpanded)}
                    className={`w-full text-left cursor-pointer group relative overflow-hidden rounded-t-lg ${!isBreakdownExpanded ? 'rounded-b-lg' : ''} transition-all duration-500 backdrop-blur-sm`}
                    style={{
                      background: `linear-gradient(135deg, ${config.accentColor}05 0%, transparent 100%)`,
                      borderBottom: isBreakdownExpanded ? `2px solid ${config.accentColor}20` : 'none',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = `linear-gradient(135deg, ${config.accentColor}15 0%, ${config.accentColor}05 100%)`;
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = `0 8px 16px -4px ${config.accentColor}30`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = `linear-gradient(135deg, ${config.accentColor}05 0%, transparent 100%)`;
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {/* Animated gradient border overlay */}
                    <div
                      className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                      style={{
                        background: `linear-gradient(90deg, ${config.accentColor}00, ${config.accentColor}40, ${config.accentColor}00)`,
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 3s infinite',
                        pointerEvents: 'none',
                      }}
                    />
                    <CardHeader
                      className="relative cursor-pointer"
                    >

                      <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-12"
                            style={{
                              background: `linear-gradient(135deg, ${config.accentColor}20, ${config.accentColor}40)`,
                              boxShadow: `0 4px 12px ${config.accentColor}30`,
                            }}
                          >
                            <svg className="w-5 h-5 transition-all duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: config.accentColor }}>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                          </div>
                          <div>
                            <CardTitle className="flex items-center gap-2 text-base font-bold">
                              Monthly Breakdown
                            </CardTitle>
                            <CardDescription className="flex items-center gap-2 mt-1">
                              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold transition-all duration-300" style={{ backgroundColor: `${config.accentColor}20`, color: config.chartColorDark }}>
                                {kpis.length} months
                              </span>
                            </CardDescription>
                          </div>
                        </div>
                        <div
                          className="flex items-center gap-3 px-4 py-2.5 rounded-xl backdrop-blur-md transition-all duration-500 group-hover:scale-105"
                          style={{
                            background: `linear-gradient(135deg, ${config.accentColor}15, ${config.accentColor}25)`,
                            border: `1px solid ${config.accentColor}40`,
                            boxShadow: `0 4px 12px ${config.accentColor}20`,
                          }}
                        >
                          <span className="text-xs font-bold tracking-wide" style={{ color: config.chartColorDark }}>
                            {isBreakdownExpanded ? 'HIDE' : 'SHOW'}
                          </span>
                          <div className="relative w-5 h-5">
                            <svg
                              className={`absolute inset-0 transition-all duration-700 ${isBreakdownExpanded ? 'rotate-180 scale-110' : 'rotate-0'}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              style={{ color: config.accentColor }}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                  </button>

                  {/* Content - Collapsible */}
                  <div
                    className={`overflow-hidden rounded-b-lg ${isBreakdownExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}
                    style={{
                      transition: 'max-height 1000ms cubic-bezier(0.4, 0, 0.2, 1), opacity 1000ms cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                      {/* Sort Options Bar */}
                      <div className="px-6 py-4 border-b border-[#E1ECDB]">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-600 mr-2">Sort by:</span>
                          <div className="flex items-center gap-2 bg-[#F8F6F2] rounded-lg p-1 border border-[#E1ECDB]">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSortOrder('chronological')}
                              className={`h-8 px-3 text-xs transition-all cursor-pointer ${
                                sortOrder === 'chronological'
                                  ? 'text-white'
                                  : 'text-gray-600 hover:bg-[#E1ECDB]/30'
                              }`}
                              style={sortOrder === 'chronological' ? { backgroundColor: config.accentColor } : {}}
                            >
                              <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              Date
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSortOrder('peak')}
                              className={`h-8 px-3 text-xs transition-all cursor-pointer ${
                                sortOrder === 'peak'
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : 'text-gray-600 hover:bg-[#E1ECDB]/30'
                              }`}
                            >
                              <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                              </svg>
                              Peak
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSortOrder('low')}
                              className={`h-8 px-3 text-xs transition-all cursor-pointer ${
                                sortOrder === 'low'
                                  ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                  : 'text-gray-600 hover:bg-[#E1ECDB]/30'
                              }`}
                            >
                              <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                              </svg>
                              Low
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Month List */}
                      <CardContent className="pt-6">
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {(() => {
                            let sortedKpis = [...kpis];

                            if (sortOrder === 'peak') {
                              // Sort by value descending (highest first)
                              sortedKpis.sort((a, b) => (b[config.dataKey] as number) - (a[config.dataKey] as number));
                            } else if (sortOrder === 'low') {
                              // Sort by value ascending (lowest first)
                              sortedKpis.sort((a, b) => (a[config.dataKey] as number) - (b[config.dataKey] as number));
                            } else {
                              // Chronological (most recent first)
                              sortedKpis = sortedKpis.slice().reverse();
                            }

                            return sortedKpis.map((kpi, idx) => {
                              const value = kpi[config.dataKey] as number;
                              const isMax = value === Math.max(...kpis.map(k => k[config.dataKey] as number));
                              const isMin = value === Math.min(...kpis.map(k => k[config.dataKey] as number));

                              // Parse month without timezone issues
                              const [year, monthNum] = kpi.month.split('-').map(Number);
                              const monthLabel = format(new Date(year, monthNum - 1, 1), 'MMMM yyyy');

                              return (
                                <div
                                  key={kpi.month}
                                  className="flex items-center justify-between p-4 bg-[#F8F6F2] hover:bg-[#E1ECDB]/20 rounded-lg transition-colors"
                                  style={{ border: '1px solid #E1ECDB' }}
                                >
                                  <div className="font-semibold text-gray-900">
                                    {monthLabel}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {isMax && <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">Peak</Badge>}
                                    {isMin && <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">Low</Badge>}
                                    <div className="text-xl font-bold text-[#88a882]">
                                      {config.format(value)}
                                    </div>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </CardContent>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
