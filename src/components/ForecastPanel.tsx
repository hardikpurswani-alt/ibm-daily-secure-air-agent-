// ─────────────────────────────────────────────────────────────────────────────
// AQI Forecast Chart — 48-hour predictive AQI with confidence bands
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell, Bar,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { Robot, Warning, Info, CheckCircle } from '@phosphor-icons/react';
import type { AQIForecast, ForecastAlert } from '../agents/types';
import { AQI_THRESHOLDS, getAQILevel } from '../agents/types';

interface ForecastPanelProps {
  forecast: AQIForecast | null;
  isLoading: boolean;
}

function getBarColor(aqi: number): string {
  if (aqi <= 50) return '#22c55e';
  if (aqi <= 100) return '#eab308';
  if (aqi <= 150) return '#f97316';
  if (aqi <= 200) return '#ef4444';
  if (aqi <= 300) return '#a855f7';
  return '#dc2626';
}

const AlertIcon = ({ severity }: { severity: ForecastAlert['severity'] }) => {
  if (severity === 'critical') return <Warning size={16} weight="fill" aria-hidden />;
  if (severity === 'warning') return <Warning size={16} aria-hidden />;
  return <Info size={16} aria-hidden />;
};

const alertColors = { critical: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };

export function ForecastPanel({ forecast, isLoading }: ForecastPanelProps) {
  if (isLoading) {
    return (
      <div>
        <div className="skeleton" style={{ height: 24, width: 200, marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 220, borderRadius: 10 }} />
      </div>
    );
  }

  if (!forecast) {
    return <div style={styles.empty}>Forecast data loading...</div>;
  }

  // Show first 24 hours, every other hour for display
  const chartData = forecast.forecasts.slice(0, 24).map((f, i) => ({
    time: format(parseISO(f.timestamp), i % 2 === 0 ? 'HH:mm' : ''),
    aqi: Math.round(f.predictedAqi),
    confidence: Math.round(f.confidence),
    level: f.level,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* IBM Granite reasoning */}
      <div style={styles.graniteCard}>
        <div style={styles.graniteHeader}>
          <Robot size={16} weight="fill" aria-hidden style={{ color: '#3b82f6' }} />
          <span style={styles.graniteLabel}>IBM Granite Forecast Reasoning</span>
        </div>
        <p style={styles.graniteText}>{forecast.graniteReasoning}</p>
        <div style={styles.graniteFooter}>
          <span>Model: {forecast.modelVersion}</span>
          <span>Generated: {format(parseISO(forecast.generatedAt), 'MMM d, HH:mm')}</span>
        </div>
      </div>

      {/* Forecast Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="time"
            tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'Fira Code, monospace' }}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'Fira Code, monospace' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              name === 'aqi' ? `AQI ${value}` : `${value}%`,
              name === 'aqi' ? 'Predicted AQI' : 'Confidence',
            ]}
            contentStyle={{
              background: 'rgba(27,35,54,0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              color: '#f8fafc',
              fontSize: 12,
              fontFamily: 'Fira Code, monospace',
            }}
          />
          <ReferenceLine y={100} stroke="#eab308" strokeDasharray="4 4" strokeOpacity={0.4} />
          <ReferenceLine y={150} stroke="#f97316" strokeDasharray="4 4" strokeOpacity={0.4} />
          <Area
            type="monotone"
            dataKey="aqi"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#forecastGrad)"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* 24-hour summary cards */}
      <div style={styles.summaryGrid}>
        {forecast.forecasts.slice(0, 8).map((f, i) => {
          const color = getBarColor(f.predictedAqi);
          return (
            <div key={i} style={{ ...styles.summaryCard, borderColor: `${color}33` }}>
              <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'Fira Code, monospace' }}>
                {format(parseISO(f.timestamp), 'HH:mm')}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: 'Fira Code, monospace' }}>
                {Math.round(f.predictedAqi)}
              </div>
              <div style={{ fontSize: 9, color: '#94a3b8', textAlign: 'center' }}>
                {f.level.split(' ')[0]}
              </div>
              <div style={{ ...styles.confBar }}>
                <div style={{ width: `${f.confidence}%`, height: '100%', background: color, borderRadius: 2, opacity: 0.7 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Alerts */}
      {forecast.alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={styles.sectionLabel}>Forecast Alerts</div>
          {forecast.alerts.map((alert) => (
            <div
              key={alert.id}
              style={{
                ...styles.alertCard,
                borderColor: `${alertColors[alert.severity]}44`,
                background: `${alertColors[alert.severity]}11`,
              }}
              role="alert"
            >
              <AlertIcon severity={alert.severity} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: alertColors[alert.severity] }}>
                  {alert.timeWindow}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{alert.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  graniteCard: {
    background: 'rgba(59, 130, 246, 0.08)',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    borderRadius: 10,
    padding: '12px 14px',
  },
  graniteHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  graniteLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#3b82f6',
    fontFamily: 'Fira Code, monospace',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  graniteText: {
    fontSize: 12,
    color: '#cbd5e1',
    lineHeight: 1.6,
  },
  graniteFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 8,
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    fontFamily: 'Fira Code, monospace',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(8, 1fr)',
    gap: 6,
  },
  summaryCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '8px 4px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid',
    borderRadius: 8,
  },
  confBar: {
    width: '100%',
    height: 3,
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#94a3b8',
    fontFamily: 'Fira Code, monospace',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  alertCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid',
  },
  empty: {
    color: '#94a3b8',
    textAlign: 'center',
    padding: 40,
    fontSize: 13,
  },
};
