// ─────────────────────────────────────────────────────────────────────────────
// Historical Trends Chart — 48-hour AQI history with pollutant breakdowns
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import type { HistoricalDataPoint } from '../agents/types';

interface HistoricalChartProps {
  data: HistoricalDataPoint[];
  isLoading: boolean;
}

type MetricKey = 'aqi' | 'pm25' | 'pm10' | 'o3' | 'no2';

const METRICS: { key: MetricKey; label: string; color: string; unit: string }[] = [
  { key: 'aqi', label: 'AQI', color: '#3b82f6', unit: '' },
  { key: 'pm25', label: 'PM2.5', color: '#22c55e', unit: 'µg/m³' },
  { key: 'pm10', label: 'PM10', color: '#f59e0b', unit: 'µg/m³' },
  { key: 'o3', label: 'O₃', color: '#a855f7', unit: 'ppb' },
  { key: 'no2', label: 'NO₂', color: '#ef4444', unit: 'ppb' },
];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={tooltipStyle}>
      <div style={{ marginBottom: 8, fontSize: 12, color: '#94a3b8', fontFamily: 'Fira Code, monospace' }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 12 }}>
          <span style={{ color: p.color }}>{p.name}</span>
          <span style={{ fontFamily: 'Fira Code, monospace', color: '#f8fafc', fontWeight: 600 }}>{p.value.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
};

const tooltipStyle: React.CSSProperties = {
  background: 'rgba(27, 35, 54, 0.95)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '10px 14px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
  minWidth: 160,
};

export function HistoricalChart({ data, isLoading }: HistoricalChartProps) {
  const [activeMetrics, setActiveMetrics] = useState<Set<MetricKey>>(new Set(['aqi', 'pm25']));

  const chartData = data.map((d) => ({
    ...d,
    time: format(parseISO(d.timestamp), 'HH:mm'),
    day: format(parseISO(d.timestamp), 'MMM d'),
  }));

  // Show every 4th label to avoid crowding
  const tickFormatter = (_: string, index: number) => {
    if (index % 4 !== 0) return '';
    return chartData[index]?.time ?? '';
  };

  const toggleMetric = (key: MetricKey) => {
    setActiveMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(key) && next.size > 1) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (isLoading) {
    return <div className="skeleton" style={{ height: 280, borderRadius: 10 }} />;
  }

  if (!data.length) {
    return <div style={styles.empty}>Historical data loading...</div>;
  }

  return (
    <div>
      {/* Metric toggles */}
      <div style={styles.toggleRow} role="group" aria-label="Toggle metrics">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => toggleMetric(m.key)}
            style={{
              ...styles.toggleBtn,
              background: activeMetrics.has(m.key) ? `${m.color}22` : 'transparent',
              borderColor: activeMetrics.has(m.key) ? m.color : 'rgba(255,255,255,0.1)',
              color: activeMetrics.has(m.key) ? m.color : '#94a3b8',
            }}
            aria-pressed={activeMetrics.has(m.key)}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, display: 'inline-block' }} aria-hidden />
            {m.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <defs>
            {METRICS.map((m) => (
              <linearGradient key={m.key} id={`grad-${m.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={m.color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={m.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="time"
            tickFormatter={tickFormatter}
            tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'Fira Code, monospace' }}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'Fira Code, monospace' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          {/* AQI threshold reference lines */}
          <ReferenceLine y={50} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: 'Good', fill: '#22c55e', fontSize: 9, position: 'right' }} />
          <ReferenceLine y={100} stroke="#eab308" strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: 'Moderate', fill: '#eab308', fontSize: 9, position: 'right' }} />
          <ReferenceLine y={150} stroke="#f97316" strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: 'Sensitive', fill: '#f97316', fontSize: 9, position: 'right' }} />
          {METRICS.map((m) =>
            activeMetrics.has(m.key) ? (
              <Area
                key={m.key}
                type="monotone"
                dataKey={m.key}
                name={m.label}
                stroke={m.color}
                strokeWidth={2}
                fill={`url(#grad-${m.key})`}
                dot={false}
                activeDot={{ r: 4, fill: m.color }}
                isAnimationActive={true}
                animationDuration={800}
              />
            ) : null,
          )}
        </AreaChart>
      </ResponsiveContainer>

      {/* Data count */}
      <div style={styles.footer}>
        <span>{data.length} hourly readings</span>
        <span>Last {Math.round(data.length)} hours</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  toggleRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  toggleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '4px 10px',
    borderRadius: 999,
    border: '1px solid',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 11,
    fontFamily: 'Fira Code, monospace',
    fontWeight: 500,
    transition: 'all 0.2s ease',
  },
  empty: {
    color: '#94a3b8',
    textAlign: 'center',
    padding: 40,
    fontSize: 13,
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 8,
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    fontFamily: 'Fira Code, monospace',
  },
};
