import { motion } from 'framer-motion'
import { Activity, Clock, Database, ShieldAlert } from 'lucide-react'
import { AQI_VISUALS, formatFreshnessLabel, formatTimestamp, getObservationBadge } from '../lib/aqiTheme'
import type { LiveAQIResponse } from '../types/airguard'

interface Props {
  live: LiveAQIResponse
}

export function AQIGaugeCard({ live }: Props) {
  const aqi = live.aqi ?? 0
  const visual = AQI_VISUALS[live.level] ?? AQI_VISUALS.Unavailable
  const obsBadge = getObservationBadge(live.primary_source.observation_type)

  const radius = 84
  const circumference = Math.PI * radius
  const progress = live.aqi !== null ? Math.min(aqi / 500, 1) : 0
  const dashOffset = circumference * (1 - progress)

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="ag-glass rounded-3xl p-6 flex flex-col justify-between gap-5"
      aria-label="Live Air Quality Index Overview"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ag-muted)]">
            Live Air Quality
          </p>
          <h2 className="text-xl font-semibold tracking-tight">
            {live.location.city}
            {live.location.country ? (
              <span className="text-sm font-normal text-[var(--ag-muted)]"> · {live.location.country}</span>
            ) : null}
          </h2>
        </div>

        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border"
          style={{
            backgroundColor: `${obsBadge.tone}18`,
            borderColor: `${obsBadge.tone}45`,
            color: obsBadge.tone,
          }}
        >
          <Database className="w-3.5 h-3.5" aria-hidden="true" />
          {obsBadge.label}
        </span>
      </div>

      <div className="flex flex-col items-center py-1">
        <svg viewBox="0 0 210 122" className="w-full max-w-[250px] overflow-visible" role="img" aria-label={`AQI ${live.aqi ?? 'Unavailable'}: ${live.level}`}>
          <path
            d="M 21 106 A 84 84 0 0 1 189 106"
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeWidth={14}
            strokeLinecap="round"
          />
          <motion.path
            d="M 21 106 A 84 84 0 0 1 189 106"
            fill="none"
            stroke={visual.color}
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 0.85, ease: 'easeOut' }}
          />
          <text
            x="105"
            y="88"
            textAnchor="middle"
            className="tabular-nums font-bold"
            style={{ fontSize: 42, fill: visual.color }}
          >
            {live.aqi !== null ? live.aqi : '—'}
          </text>
          <text
            x="105"
            y="108"
            textAnchor="middle"
            style={{ fontSize: 11, fill: 'var(--ag-muted)', fontWeight: 600 }}
          >
            {live.aqi_scale}
          </text>
        </svg>

        <div
          className="mt-2 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold border"
          style={{
            backgroundColor: visual.softBg,
            borderColor: visual.border,
            color: visual.color,
          }}
        >
          <ShieldAlert className="w-4 h-4" aria-hidden="true" />
          <span>{live.level}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
        <div className="rounded-2xl border border-[var(--ag-border)] px-3 py-2.5">
          <div className="text-[var(--ag-muted)] flex items-center gap-1">
            <Activity className="w-3.5 h-3.5" aria-hidden="true" /> Dominant
          </div>
          <div className="mt-0.5 font-semibold tabular-nums">{live.dominant_pollutant || '—'}</div>
        </div>
        <div className="rounded-2xl border border-[var(--ag-border)] px-3 py-2.5">
          <div className="text-[var(--ag-muted)] flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" /> Freshness
          </div>
          <div className="mt-0.5 font-semibold">
            {formatFreshnessLabel(live.primary_source.freshness, live.primary_source.freshness_minutes)}
          </div>
        </div>
        <div className="col-span-2 sm:col-span-1 rounded-2xl border border-[var(--ag-border)] px-3 py-2.5">
          <div className="text-[var(--ag-muted)]">Cross-Scales</div>
          <div className="mt-0.5 font-semibold tabular-nums">
            US {live.us_aqi ?? '—'} · EU {live.european_aqi ?? '—'}
          </div>
        </div>
      </div>

      <div className="text-xs text-[var(--ag-muted)] border-t border-[var(--ag-border)] pt-3 flex flex-wrap justify-between gap-2">
        <span>
          Source: <strong className="text-[var(--ag-text)] font-medium">{live.primary_source.source_name}</strong>
          {live.primary_source.station_name ? ` (${live.primary_source.station_name})` : ''}
        </span>
        <span>Observed {formatTimestamp(live.primary_source.observed_at)}</span>
      </div>
    </motion.section>
  )
}
