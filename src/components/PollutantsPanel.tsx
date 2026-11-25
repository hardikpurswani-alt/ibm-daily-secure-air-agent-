// ─────────────────────────────────────────────────────────────────────────────
// Pollutants Panel — Real-time breakdown of individual pollutants
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { ArrowUp, ArrowDown, Minus } from '@phosphor-icons/react';
import type { Pollutant } from '../agents/types';

interface PollutantsPanelProps {
  pollutants: Pollutant[];
  isLoading: boolean;
}

const POLLUTANT_INFO: Record<string, { description: string; safeLimit: string; icon: string }> = {
  'PM2.5': { description: 'Fine particles', safeLimit: '< 12 µg/m³', icon: '🔵' },
  'PM10': { description: 'Coarse particles', safeLimit: '< 54 µg/m³', icon: '⬤' },
  'Ozone (O₃)': { description: 'Ground-level ozone', safeLimit: '< 70 ppb', icon: '○' },
  'Nitrogen Dioxide (NO₂)': { description: 'Vehicle exhaust', safeLimit: '< 100 ppb', icon: '◈' },
  'Sulfur Dioxide (SO₂)': { description: 'Industrial emissions', safeLimit: '< 75 ppb', icon: '◇' },
  'Carbon Monoxide (CO)': { description: 'Combustion gas', safeLimit: '< 4.4 ppm', icon: '◎' },
};

function getBarColor(aqi: number): string {
  if (aqi <= 50) return '#22c55e';
  if (aqi <= 100) return '#eab308';
  if (aqi <= 150) return '#f97316';
  if (aqi <= 200) return '#ef4444';
  if (aqi <= 300) return '#a855f7';
  return '#dc2626';
}

export function PollutantsPanel({ pollutants, isLoading }: PollutantsPanelProps) {
  if (isLoading) {
    return (
      <div style={styles.grid}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 72, borderRadius: 10 }} />
        ))}
      </div>
    );
  }

  if (!pollutants.length) {
    return <div style={styles.empty}>No pollutant data available</div>;
  }

  return (
    <div style={styles.grid}>
      {pollutants.map((p) => {
        const barWidth = Math.min((p.aqi / 300) * 100, 100);
        const barColor = getBarColor(p.aqi);
        const TrendIcon = p.trend === 'up' ? ArrowUp : p.trend === 'down' ? ArrowDown : Minus;
        const trendColor = p.trend === 'up' ? '#ef4444' : p.trend === 'down' ? '#22c55e' : '#94a3b8';

        return (
          <div
            key={p.name}
            style={styles.card}
            className="glass-card animate-float"
          >
            <div style={styles.cardHeader}>
              <div style={styles.pollutantName}>{p.name}</div>
              <div style={{ ...styles.trendBadge, color: trendColor }}>
                <TrendIcon size={12} weight="bold" aria-hidden />
                <span>{Math.abs(p.changePercent)}%</span>
              </div>
            </div>

            <div style={styles.valueRow}>
              <span style={{ ...styles.value, color: barColor }}>
                {typeof p.value === 'number' ? p.value.toFixed(1) : '—'}
              </span>
              <span style={styles.unit}>{p.unit}</span>
            </div>

            {/* Progress bar */}
            <div style={styles.barTrack} role="progressbar" aria-valuenow={p.aqi} aria-valuemin={0} aria-valuemax={300} aria-label={`${p.name} AQI`}>
              <div
                style={{
                  ...styles.barFill,
                  width: `${barWidth}%`,
                  background: barColor,
                  boxShadow: `0 0 6px ${barColor}66`,
                }}
              />
            </div>

            <div style={styles.cardFooter}>
              <span style={styles.footerLabel}>AQI {p.aqi}</span>
              <span style={styles.footerLabel}>{POLLUTANT_INFO[p.name]?.safeLimit ?? 'Safe: —'}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 10,
  },
  card: {
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pollutantName: {
    fontSize: 11,
    fontWeight: 600,
    color: '#94a3b8',
    fontFamily: 'Fira Code, monospace',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  trendBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    fontSize: 11,
    fontWeight: 600,
  },
  valueRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 4,
  },
  value: {
    fontSize: 24,
    fontWeight: 700,
    fontFamily: 'Fira Code, monospace',
    lineHeight: 1,
  },
  unit: {
    fontSize: 11,
    color: '#94a3b8',
  },
  barTrack: {
    height: 4,
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 1s ease',
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  footerLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    fontFamily: 'Fira Code, monospace',
  },
  empty: {
    color: '#94a3b8',
    textAlign: 'center',
    padding: 24,
    fontSize: 13,
  },
};
