'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format } from 'date-fns';
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

type MetricType =
  | 'gross_revenue'
  | 'net_revenue'
  | 'expenses'
  | 'occupancy_rate'
  | 'vacancy_rate'
  | 'nights_booked';

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
    format: (value: number) => string;
    dataKey: keyof KPI;
  }
> = {
  gross_revenue: {
    label: 'Gross Revenue',
    color: '#10b981',
    format: (val) => formatMoney(val),
    dataKey: 'gross_revenue_cents',
  },
  net_revenue: {
    label: 'Net Revenue',
    color: '#3b82f6',
    format: (val) => formatMoney(val),
    dataKey: 'net_revenue_cents',
  },
  expenses: {
    label: 'Expenses',
    color: '#ef4444',
    format: (val) => formatMoney(val),
    dataKey: 'expenses_cents',
  },
  occupancy_rate: {
    label: 'Occupancy Rate',
    color: '#8b5cf6',
    format: (val) => formatPercent(val),
    dataKey: 'occupancy_rate',
  },
  vacancy_rate: {
    label: 'Vacancy Rate',
    color: '#f59e0b',
    format: (val) => formatPercent(val),
    dataKey: 'vacancy_rate',
  },
  nights_booked: {
    label: 'Nights Booked',
    color: '#06b6d4',
    format: (val) => formatNumber(val),
    dataKey: 'nights_booked',
  },
};

export default function MetricChart({ orgId, metricType, title, onClose }: MetricChartProps) {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [orgId]);

  // Transform data for the chart
  const chartData = kpis.map((kpi) => ({
    month: format(new Date(kpi.month), 'MMM yyyy'),
    value: kpi[config.dataKey] as number,
  }));

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 16,
          padding: '24px',
          maxWidth: 900,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>{title}</h2>
            <p style={{ color: '#6b7280', fontSize: 14 }}>Historical data for the last 12 months</p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#f3f4f6',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Close
          </button>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
            Loading historical data...
          </div>
        )}

        {error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              padding: 16,
              color: '#991b1b',
            }}
          >
            Error: {error}
          </div>
        )}

        {!loading && !error && chartData.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
            No historical data available
          </div>
        )}

        {!loading && !error && chartData.length > 0 && (
          <>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="month"
                  stroke="#6b7280"
                  style={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  stroke="#6b7280"
                  style={{ fontSize: 12 }}
                  tickFormatter={(value) => {
                    // Simplify Y-axis labels
                    if (config.dataKey.includes('cents')) {
                      return formatMoney(value, { compact: true });
                    }
                    if (config.dataKey.includes('rate')) {
                      return formatPercent(value, 0);
                    }
                    return formatNumber(value);
                  }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: 12,
                  }}
                  formatter={(value: number) => [config.format(value), config.label]}
                />
                <Legend wrapperStyle={{ paddingTop: 20 }} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={config.color}
                  strokeWidth={3}
                  dot={{ fill: config.color, r: 4 }}
                  activeDot={{ r: 6 }}
                  name={config.label}
                />
              </LineChart>
            </ResponsiveContainer>

            {/* Summary Statistics */}
            <div
              style={{
                marginTop: 32,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
              }}
            >
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Latest</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: config.color }}>
                  {config.format(chartData[chartData.length - 1]?.value || 0)}
                </div>
              </div>
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Average</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>
                  {config.format(
                    chartData.reduce((sum, d) => sum + d.value, 0) / chartData.length || 0
                  )}
                </div>
              </div>
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Highest</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: '#10b981' }}>
                  {config.format(Math.max(...chartData.map((d) => d.value)))}
                </div>
              </div>
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Lowest</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: '#ef4444' }}>
                  {config.format(Math.min(...chartData.map((d) => d.value)))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
