import { useState } from 'react'
import { Download } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAirGuardStore } from '../store/useAirGuardStore'

type MetricKey = 'aqi' | 'pm25' | 'pm10' | 'o3' | 'no2' | 'so2' | 'co'

const METRICS: Array<{ key: MetricKey; label: string; color: string; unit: string }> = [
  { key: 'aqi', label: 'US AQI', color: '#0284c7', unit: '' },
  { key: 'pm25', label: 'PM2.5', color: '#16a34a', unit: 'µg/m³' },
  { key: 'pm10', label: 'PM10', color: '#eab308', unit: 'µg/m³' },
  { key: 'o3', label: 'O₃', color: '#9333ea', unit: 'µg/m³' },
  { key: 'no2', label: 'NO₂', color: '#ef4444', unit: 'µg/m³' },
  { key: 'so2', label: 'SO₂', color: '#f97316', unit: 'µg/m³' },
]

export function HistoricalAnalyticsPage() {
  const { briefing } = useAirGuardStore()
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(['aqi', 'pm25'])

  if (!briefing) return null
  const { historical } = briefing

  const chartData = historical.points.map((pt) => ({
    ...pt,
    label: pt.timestamp.slice(5, 16).replace('T', ' '),
  }))

  const toggleMetric = (key: MetricKey) => {
    setSelectedMetrics((prev) =>
      prev.includes(key) ? (prev.length > 1 ? prev.filter((k) => k !== key) : prev) : [...prev, key],
    )
  }

  const exportCsv = () => {
    const header = 'timestamp,aqi,pm25,pm10,o3,no2,so2,co,nh3\n'
    const rows = historical.points
      .map((p) => [p.timestamp, p.aqi ?? '', p.pm25 ?? '', p.pm10 ?? '', p.o3 ?? '', p.no2 ?? '', p.so2 ?? '', p.co ?? '', p.nh3 ?? ''].join(','))
      .join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `airguard-history-${historical.location.city.toLowerCase().replace(/\s+/g, '-')}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Historical AQI Analytics ({historical.hours}h)</h2>
          <p className="text-sm text-[var(--ag-muted)]">
            Source: {historical.source_name} ({historical.observation_type.replace('_', ' ')})
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="min-h-[42px] px-4 py-2 rounded-full border border-[var(--ag-border)] text-xs font-semibold inline-flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
        >
          <Download className="w-4 h-4 text-[var(--ag-accent)]" aria-hidden="true" />
          Export CSV
        </button>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="ag-glass rounded-2xl p-4">
          <div className="text-xs text-[var(--ag-muted)]">Minimum AQI</div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{historical.stats.min_aqi ?? '—'}</div>
        </div>
        <div className="ag-glass rounded-2xl p-4">
          <div className="text-xs text-[var(--ag-muted)]">Maximum AQI</div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{historical.stats.max_aqi ?? '—'}</div>
        </div>
        <div className="ag-glass rounded-2xl p-4">
          <div className="text-xs text-[var(--ag-muted)]">Average AQI</div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{historical.stats.avg_aqi ?? '—'}</div>
        </div>
        <div className="ag-glass rounded-2xl p-4">
          <div className="text-xs text-[var(--ag-muted)]">Mean PM2.5</div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{historical.stats.avg_pm25 ?? '—'} µg/m³</div>
        </div>
        <div className="col-span-2 md:col-span-1 ag-glass rounded-2xl p-4">
          <div className="text-xs text-[var(--ag-muted)]">Hours &gt; 100 AQI</div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{historical.stats.exceedance_hours_over_100}</div>
        </div>
      </div>

      <section className="ag-glass rounded-3xl p-6 space-y-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Chart metrics">
          {METRICS.map((m) => {
            const active = selectedMetrics.includes(m.key)
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => toggleMetric(m.key)}
                aria-pressed={active}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold border transition inline-flex items-center gap-1.5 cursor-pointer"
                style={{
                  borderColor: active ? m.color : 'var(--ag-border)',
                  backgroundColor: active ? `${m.color}20` : 'transparent',
                  color: active ? m.color : 'var(--ag-muted)',
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} aria-hidden="true" />
                {m.label}
              </button>
            )
          })}
        </div>

        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--ag-muted)' }} minTickGap={32} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--ag-muted)' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--ag-surface-elevated)',
                  border: '1px solid var(--ag-border)',
                  borderRadius: 14,
                  color: 'var(--ag-text)',
                  fontSize: 12,
                }}
              />
              <ReferenceLine y={50} stroke="#16a34a" strokeDasharray="4 4" strokeOpacity={0.5} />
              <ReferenceLine y={100} stroke="#eab308" strokeDasharray="4 4" strokeOpacity={0.5} />
              <ReferenceLine y={150} stroke="#ea580c" strokeDasharray="4 4" strokeOpacity={0.5} />
              {METRICS.filter((m) => selectedMetrics.includes(m.key)).map((m) => (
                <Area
                  key={m.key}
                  type="monotone"
                  dataKey={m.key}
                  name={m.label}
                  stroke={m.color}
                  strokeWidth={2}
                  fill={m.color}
                  fillOpacity={0.14}
                  dot={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  )
}
