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
    iconPath: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    format: (val) => formatMoney(val),
    dataKey: 'gross_revenue_cents',
  },
  net_revenue: {
    label: 'Net Revenue',
    color: '#E1ECDB',
    gradientStart: '#E1ECDB',
    gradientEnd: '#c5d4bf',
    iconPath: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
    format: (val) => formatMoney(val),
    dataKey: 'net_revenue_cents',
  },
  expenses: {
    label: 'Expenses',
    color: '#ef4444',
    gradientStart: '#ef4444',
    gradientEnd: '#dc2626',
    iconPath: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
    format: (val) => formatMoney(val),
    dataKey: 'expenses_cents',
  },
  occupancy_rate: {
    label: 'Occupancy Rate',
    color: '#E1ECDB',
    gradientStart: '#E1ECDB',
    gradientEnd: '#c5d4bf',
    iconPath: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    format: (val) => formatPercent(val),
    dataKey: 'occupancy_rate',
  },
  vacancy_rate: {
    label: 'Vacancy Rate',
    color: '#f59e0b',
    gradientStart: '#f59e0b',
    gradientEnd: '#d97706',
    iconPath: 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6',
    format: (val) => formatPercent(val),
    dataKey: 'vacancy_rate',
  },
  nights_booked: {
    label: 'Nights Booked',
    color: '#E1ECDB',
    gradientStart: '#E1ECDB',
    gradientEnd: '#c5d4bf',
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

  const config = METRIC_CONFIG[metricType];

  useEffect(() => {
    async function fetchHistory() {
      try {
        setLoading(true);
        const res = await fetch(`/api/orgs/${orgId}/kpis/history?months=12`);
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
          const response = await fetch(`/api/orgs/${orgId}/ledger`);
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
          const response = await fetch(`/api/orgs/${orgId}/bookings`);
          const data = await response.json();

          if (data.ok && data.bookings) {
            // Filter bookings for the selected month
            const filtered = data.bookings.filter((booking: Booking) => {
              const bookingMonth = booking.check_in.slice(0, 7) + '-01';
              return bookingMonth === selectedMonth && booking.status === 'completed';
            });
            setMonthlyBookings(filtered);
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
      // For occupancy/vacancy, show cumulative percentage by day
      let cumulativeNights = 0;
      monthlyBookings.forEach(booking => {
        const checkIn = new Date(booking.check_in);
        const checkOut = new Date(booking.check_out);
        const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
        cumulativeNights += nights;
      });

      dailyData.forEach((dayData, idx) => {
        const daysElapsed = idx + 1;
        const rate = cumulativeNights / daysElapsed;
        dayData.value = metricType === 'occupancy_rate' ? rate : (1 - rate);
      });
    }

    return dailyData;
  })();

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#F8F6F2] rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-auto animate-in zoom-in-95 duration-200"
        style={{ border: '2px solid #E1ECDB' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-[#a8c5a0] to-[#8fb389] text-white px-6 py-5 rounded-t-2xl border-b border-[#E1ECDB]/20" style={{ background: 'linear-gradient(to right, #9db896, #88a882)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={config.iconPath} />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold">{config.label}</h2>
                <p className="text-white/90 text-sm mt-0.5">
                  {viewMode === 'monthly' ? 'Monthly Performance Analysis' : 'Annual Performance Overview'}
                </p>
              </div>
            </div>
            <Button
              onClick={onClose}
              variant="ghost"
              className="text-white hover:bg-white/20 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
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
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button
                    onClick={() => setViewMode('monthly')}
                    variant={viewMode === 'monthly' ? 'default' : 'outline'}
                    className={`transition-all ${viewMode === 'monthly' ? 'bg-[#9db896] hover:bg-[#88a882] text-white' : 'border-[#E1ECDB] hover:bg-[#E1ECDB]/30'}`}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Monthly View
                  </Button>
                  <Button
                    onClick={() => setViewMode('annual')}
                    variant={viewMode === 'annual' ? 'default' : 'outline'}
                    className={`transition-all ${viewMode === 'annual' ? 'bg-[#9db896] hover:bg-[#88a882] text-white' : 'border-[#E1ECDB] hover:bg-[#E1ECDB]/30'}`}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Annual View
                  </Button>
                </div>

                {viewMode === 'monthly' && (
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg bg-white hover:border-[#9db896] focus:outline-none focus:ring-2 focus:ring-[#9db896] transition-all"
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
                )}
              </div>

              {/* Featured Metric Card */}
              <Card className="shadow-lg bg-white" style={{ border: '2px solid #9db896' }}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#9db896]/20">
                      <svg className="w-5 h-5 text-[#9db896]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                  <div className="text-5xl font-bold mb-2 text-[#88a882]">
                    {viewMode === 'monthly'
                      ? config.format(selectedValue)
                      : config.format(annualData?.total || 0)}
                  </div>
                  {viewMode === 'annual' && (
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
                    <svg className="w-5 h-5 text-[#9db896]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    <ResponsiveContainer width="100%" height={450}>
                      {viewMode === 'monthly' ? (
                        <LineChart data={dailyChartData} margin={{ top: 10, right: 30, left: 20, bottom: 40 }}>
                          <defs>
                            <linearGradient id={`gradient-monthly-${metricType}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#9db896" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#9db896" stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                          <XAxis
                            dataKey="day"
                            stroke="#6b7280"
                            style={{ fontSize: 12, fontWeight: 500 }}
                            label={{ value: 'Day of Month', position: 'insideBottom', offset: -10 }}
                          />
                          <YAxis
                            stroke="#6b7280"
                            style={{ fontSize: 12, fontWeight: 500 }}
                            label={{ value: config.dataKey.includes('cents') ? 'Amount ($)' : 'Value', angle: -90, position: 'insideLeft' }}
                            tickFormatter={(value) => {
                              if (config.dataKey.includes('cents')) {
                                const dollars = value / 100;
                                if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
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
                              background: 'white',
                              border: '2px solid #E1ECDB',
                              borderRadius: 12,
                              padding: 16,
                              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                            }}
                            labelFormatter={(day) => `Day ${day}`}
                            formatter={(value: number, name, props) => {
                              const entries = props.payload.entries || [];
                              return [
                                <div key="tooltip">
                                  <div className="font-bold mb-1">{config.format(value)}</div>
                                  {entries.length > 0 && (
                                    <div className="text-xs text-gray-600">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</div>
                                  )}
                                </div>,
                                config.label
                              ];
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#9db896"
                            strokeWidth={3}
                            fill={`url(#gradient-monthly-${metricType})`}
                            dot={{ fill: '#9db896', r: 4, strokeWidth: 2, stroke: 'white' }}
                            activeDot={{ r: 6, strokeWidth: 2, stroke: 'white', fill: '#9db896' }}
                          />
                        </LineChart>
                      ) : (
                        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 60 }}>
                          <defs>
                            <linearGradient id={`gradient-annual-${metricType}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#9db896" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#9db896" stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                          <XAxis
                            dataKey="month"
                            stroke="#6b7280"
                            style={{ fontSize: 12, fontWeight: 500 }}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis
                            stroke="#6b7280"
                            style={{ fontSize: 12, fontWeight: 500 }}
                            tickFormatter={(value) => {
                              if (config.dataKey.includes('cents')) {
                                const dollars = value / 100;
                                if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
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
                              background: 'white',
                              border: '2px solid #E1ECDB',
                              borderRadius: 12,
                              padding: 16,
                              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                            }}
                            labelStyle={{ fontWeight: 600, marginBottom: 8 }}
                            formatter={(value: number) => [config.format(value), config.label]}
                          />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#9db896"
                            strokeWidth={3}
                            fill={`url(#gradient-annual-${metricType})`}
                            dot={{ fill: '#9db896', r: 5, strokeWidth: 2, stroke: 'white' }}
                            activeDot={{ r: 7, strokeWidth: 2, stroke: 'white', fill: '#9db896' }}
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
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-[#9db896]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                      All Entries This Month
                    </CardTitle>
                    <CardDescription>
                      {monthlyEntries.length + monthlyBookings.length} total {monthlyEntries.length + monthlyBookings.length === 1 ? 'entry' : 'entries'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {/* Ledger Entries */}
                      {monthlyEntries.sort((a, b) => a.entry_date.localeCompare(b.entry_date)).map((entry) => {
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
                      })}

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
                                  Day {day} - {format(checkInDate, 'MMM d, yyyy')}
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
                </Card>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-white shadow-md hover:shadow-lg transition-shadow" style={{ border: '1px solid #E1ECDB' }}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-[#E1ECDB]/30 flex items-center justify-center">
                        <svg className="w-4 h-4 text-[#9db896]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Latest</div>
                    </div>
                    <div className="text-2xl font-bold text-[#88a882]">
                      {config.format(chartData[chartData.length - 1]?.value || 0)}
                    </div>
                    <Badge variant="secondary" className="mt-2 bg-[#E1ECDB]/30 text-[#88a882] border-[#E1ECDB]">Most Recent</Badge>
                  </CardContent>
                </Card>

                <Card className="bg-white shadow-md hover:shadow-lg transition-shadow" style={{ border: '1px solid #E1ECDB' }}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-[#E1ECDB]/30 flex items-center justify-center">
                        <svg className="w-4 h-4 text-[#9db896]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Average</div>
                    </div>
                    <div className="text-2xl font-bold text-[#88a882]">
                      {config.format(
                        chartData.reduce((sum, d) => sum + d.value, 0) / chartData.length || 0
                      )}
                    </div>
                    <Badge variant="secondary" className="mt-2 bg-[#E1ECDB]/30 text-[#88a882] border-[#E1ECDB]">Mean Value</Badge>
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
                    className="w-full text-left"
                  >
                    <CardHeader className="hover:bg-[#E1ECDB]/10 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-[#9db896]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                            Monthly Breakdown
                          </CardTitle>
                          <CardDescription>Detailed performance by month ({kpis.length} months)</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Collapse Toggle */}
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#E1ECDB]/30 border border-[#E1ECDB]">
                            <span className="text-xs font-medium text-gray-600">
                              {isBreakdownExpanded ? 'Hide' : 'Show'}
                            </span>
                            <svg
                              className={`w-5 h-5 text-[#9db896] transition-transform duration-300 ${isBreakdownExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                  </button>

                  {/* Content - Collapsible */}
                  {isBreakdownExpanded && (
                    <>
                      {/* Sort Options Bar */}
                      <div className="px-6 pb-4 border-b border-[#E1ECDB]">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-600 mr-2">Sort by:</span>
                          <div className="flex items-center gap-2 bg-[#F8F6F2] rounded-lg p-1 border border-[#E1ECDB]">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSortOrder('chronological')}
                              className={`h-8 px-3 text-xs transition-all ${
                                sortOrder === 'chronological'
                                  ? 'bg-[#9db896] text-white hover:bg-[#88a882]'
                                  : 'text-gray-600 hover:bg-[#E1ECDB]/30'
                              }`}
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
                              className={`h-8 px-3 text-xs transition-all ${
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
                              className={`h-8 px-3 text-xs transition-all ${
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
                      <CardContent>
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
                                  <div className="flex items-center gap-4">
                                    <div className="text-2xl font-bold text-gray-400 w-8">
                                      #{idx + 1}
                                    </div>
                                    <div>
                                      <div className="font-semibold text-gray-900">
                                        {monthLabel}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="text-xl font-bold text-[#88a882]">
                                      {config.format(value)}
                                    </div>
                                    {isMax && <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">Peak</Badge>}
                                    {isMin && <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">Low</Badge>}
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </CardContent>
                    </>
                  )}
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
