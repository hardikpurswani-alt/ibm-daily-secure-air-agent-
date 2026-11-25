// ─────────────────────────────────────────────────────────────────────────────
// AQI Gauge — Live Air Quality Index display with animated ring
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo } from 'react';
import { AQI_THRESHOLDS, getAQILevel } from '../agents/types';
import type { AQIReading } from '../agents/types';

interface AQIGaugeProps {
  reading: AQIReading | null;
  isLoading: boolean;
}

const AQI_COLOR_MAP: Record<string, string> = {
  Good: '#22c55e',
  Moderate: '#eab308',
  'Unhealthy for Sensitive Groups': '#f97316',
  Unhealthy: '#ef4444',
  'Very Unhealthy': '#a855f7',
  Hazardous: '#dc2626',
};

export function AQIGauge({ reading, isLoading }: AQIGaugeProps) {
  const aqi = reading?.aqi ?? 0;
  const level = reading?.level ?? getAQILevel(aqi);
  const color = AQI_COLOR_MAP[level] ?? '#22c55e';

  // SVG arc parameters
  const radius = 80;
  const circumference = Math.PI * radius; // half-circle
  const maxAqi = 500;
  const progress = Math.min(aqi / maxAqi, 1);
  const strokeDashoffset = circumference * (1 - progress);

  const ticks = useMemo(() => {
    return Object.entries(AQI_THRESHOLDS).map(([label, { min, color: c }]) => {
      const angle = (min / maxAqi) * 180 - 180;
      const rad = (angle * Math.PI) / 180;
      const x = 100 + (radius + 14) * Math.cos(rad);
      const y = 100 + (radius + 14) * Math.sin(rad);
      return { label, x, y, color: c.bg };
    });
  }, []);

  if (isLoading) {
    return (
      <div style={styles.wrapper}>
        <div className="skeleton" style={{ width: 200, height: 200, borderRadius: '50%' }} />
        <div className="skeleton" style={{ width: 120, height: 24, marginTop: 16 }} />
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      {/* SVG Gauge */}
      <svg viewBox="0 0 200 110" style={styles.svg} role="img" aria-label={`AQI ${aqi}: ${level}`}>
        {/* Background arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Colored progress arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s ease' }}
        />
        {/* Glow effect */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          opacity="0.3"
          style={{ filter: 'blur(4px)', transition: 'stroke-dashoffset 1s ease' }}
        />
        {/* AQI Value text */}
        <text x="100" y="88" textAnchor="middle" style={{ fontSize: 36, fontWeight: 700, fill: color, fontFamily: 'Fira Code, monospace' }}>
          {aqi}
        </text>
        <text x="100" y="104" textAnchor="middle" style={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)', fontFamily: 'Fira Sans, sans-serif' }}>
          US AQI
        </text>
      </svg>

      {/* Level badge */}
      <div style={{ ...styles.levelBadge, background: `${color}22`, borderColor: `${color}44`, color }}>
        <span style={styles.liveDot} className="animate-blink" />
        {level}
      </div>

      {/* Dominant pollutant */}
      {reading?.dominantPollutant && (
        <div style={styles.dominant}>
          Dominant: <strong style={{ color: '#94a3b8' }}>{reading.dominantPollutant}</strong>
        </div>
      )}

      {/* AQI Scale Legend */}
      <div style={styles.legend} role="list" aria-label="AQI Scale">
        {Object.entries(AQI_THRESHOLDS).map(([label, { min, max, color: c }]) => (
          <div
            key={label}
            role="listitem"
            title={`${label}: ${min}–${max}`}
            style={{
              ...styles.legendDot,
              background: c.bg,
              transform: label === level ? 'scale(1.3)' : 'scale(1)',
              boxShadow: label === level ? `0 0 8px ${c.bg}` : 'none',
            }}
            aria-current={label === level ? 'true' : undefined}
          />
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: '24px 16px',
  },
  svg: {
    width: '100%',
    maxWidth: 220,
    overflow: 'visible',
  },
  levelBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 16px',
    borderRadius: 999,
    border: '1px solid',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'Fira Code, monospace',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: 'currentColor',
    display: 'inline-block',
  },
  dominant: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Fira Sans, sans-serif',
  },
  legend: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
  },
};
