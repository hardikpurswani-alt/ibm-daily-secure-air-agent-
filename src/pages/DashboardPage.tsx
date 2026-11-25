import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bot,
  CalendarClock,
  Droplets,
  HeartPulse,
  Send,
  ShieldCheck,
  Users,
  Wind,
} from 'lucide-react'
import { AQIGaugeCard } from '../components/AQIGaugeCard'
import { PollutionMapWidget } from '../components/PollutionMapWidget'
import { AQI_VISUALS, getObservationBadge } from '../lib/aqiTheme'
import { useAirGuardStore } from '../store/useAirGuardStore'

export function DashboardPage() {
  const { briefing, alerts, setActivePage, sendChatMessage } = useAirGuardStore()
  const [quickPrompt, setQuickPrompt] = useState('')

  if (!briefing) return null

  const { live_aqi, health_advisory, forecast, community, agent_trace } = briefing
  const unreadAlerts = alerts.filter((a) => !a.read)

  const handleQuickAsk = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickPrompt.trim()) return
    const q = quickPrompt.trim()
    setQuickPrompt('')
    setActivePage('assistant')
    await sendChatMessage(q)
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Environmental Intelligence Overview</h2>
          <p className="text-sm text-[var(--ag-muted)]">{live_aqi.summary}</p>
        </div>
        <button
          type="button"
          onClick={() => setActivePage('assistant')}
          className="min-h-[42px] px-4 py-2 rounded-full bg-[var(--ag-accent)] text-white text-sm font-semibold inline-flex items-center gap-2 shadow-sm cursor-pointer"
        >
          <Bot className="w-4 h-4" aria-hidden="true" />
          Ask Coordinator Agent
        </button>
      </div>

      {/* Bento Row 1: Live AQI Gauge + Health Summary + Quick AI Ask */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5">
          <AQIGaugeCard live={live_aqi} />
        </div>

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="lg:col-span-7 ag-glass rounded-3xl p-6 flex flex-col justify-between gap-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ag-muted)] flex items-center gap-1.5">
                <HeartPulse className="w-3.5 h-3.5 text-rose-500" aria-hidden="true" />
                Personalized Daily Health Guidance
              </p>
              <h3 className="mt-1 text-lg font-bold">{health_advisory.headline_recommendation}</h3>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold border border-[var(--ag-border)]">
              Personal Risk: {health_advisory.personalized_risk_level}
            </span>
          </div>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm">
            {health_advisory.daily_precautions.slice(0, 4).map((item, i) => (
              <li key={i} className="rounded-2xl border border-[var(--ag-border)] px-3.5 py-2.5 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-[var(--ag-emerald)] shrink-0 mt-0.5" aria-hidden="true" />
                <span className="text-xs leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--ag-border)] text-xs text-[var(--ag-muted)]">
            <span>{health_advisory.mask_and_indoor_guidance}</span>
            <button
              type="button"
              onClick={() => setActivePage('health')}
              className="text-[var(--ag-accent)] font-semibold inline-flex items-center gap-1 hover:underline cursor-pointer"
            >
              Adjust Health Profile <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </motion.section>
      </div>

      {/* Bento Row 2: Pollutant Concentrations Grid */}
      <section className="ag-glass rounded-3xl p-6 space-y-4" aria-label="Pollutant Concentrations">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold">Key Pollutants & WHO 2021 Guideline Check</h3>
            <p className="text-xs text-[var(--ag-muted)]">
              Real-time measurements and modelled concentrations; unavailable species (e.g., Pb) are clearly disclosed.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActivePage('live')}
            className="text-xs font-semibold text-[var(--ag-accent)] inline-flex items-center gap-1 hover:underline cursor-pointer"
          >
            Inspect Full Telemetry <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
          {live_aqi.pollutants.map((p) => {
            const obs = getObservationBadge(p.observation_type)
            const TrendIcon = p.trend === 'up' ? ArrowUpRight : p.trend === 'down' ? ArrowDownRight : null
            return (
              <div key={p.code} className="rounded-2xl border border-[var(--ag-border)] p-3.5 flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{p.code}</span>
                  {TrendIcon ? (
                    <TrendIcon
                      className={`w-3.5 h-3.5 ${p.trend === 'up' ? 'text-rose-500' : 'text-emerald-500'}`}
                      aria-hidden="true"
                    />
                  ) : null}
                </div>
                <div>
                  <div className="text-xl font-bold tabular-nums">
                    {p.available && p.value !== null ? p.value : 'N/A'}
                  </div>
                  <div className="text-[11px] text-[var(--ag-muted)]">{p.available ? p.unit : 'Not telemetered'}</div>
                </div>
                <div className="text-[10px] font-medium" style={{ color: obs.tone }}>
                  {obs.label}
                </div>
              </div>
            )
          })}
        </div>

        {live_aqi.meteorology ? (
          <div className="flex flex-wrap gap-4 pt-2 border-t border-[var(--ag-border)] text-xs text-[var(--ag-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <Wind className="w-3.5 h-3.5 text-[var(--ag-accent)]" aria-hidden="true" />
              Wind: <strong className="text-[var(--ag-text)]">{live_aqi.meteorology.wind_speed_kmh ?? '—'} km/h</strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5 text-[var(--ag-accent)]" aria-hidden="true" />
              Humidity: <strong className="text-[var(--ag-text)]">{live_aqi.meteorology.relative_humidity_pct ?? '—'}%</strong>
            </span>
            <span>
              Temp: <strong className="text-[var(--ag-text)]">{live_aqi.meteorology.temperature_c ?? '—'}°C</strong>
            </span>
            <span>
              UV Index: <strong className="text-[var(--ag-text)]">{live_aqi.meteorology.uv_index ?? '—'}</strong>
            </span>
          </div>
        ) : null}
      </section>

      {/* Bento Row 3: Map Preview + Forecast / Alerts / Community */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <section className="xl:col-span-7 ag-glass rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-bold">Regional Station Map & Hotspots</h3>
            <button
              type="button"
              onClick={() => setActivePage('map')}
              className="text-xs font-semibold text-[var(--ag-accent)] inline-flex items-center gap-1 hover:underline cursor-pointer"
            >
              Open Full Map <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
          <PollutionMapWidget location={live_aqi.location} hotspots={live_aqi.hotspots} heightClass="h-[300px]" />
        </section>

        <div className="xl:col-span-5 flex flex-col gap-5">
          {/* Forecast Snapshot */}
          <section className="ag-glass rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <CalendarClock className="w-4 h-4 text-[var(--ag-accent)]" aria-hidden="true" />
                48h Forecast ({forecast.trend_direction})
              </h3>
              <button
                type="button"
                onClick={() => setActivePage('forecast')}
                className="text-xs font-semibold text-[var(--ag-accent)] hover:underline cursor-pointer"
              >
                Details
              </button>
            </div>
            <p className="text-xs text-[var(--ag-muted)] leading-relaxed">{forecast.granite_reasoning}</p>
            <div className="grid grid-cols-4 gap-2">
              {forecast.forecasts.slice(0, 4).map((pt) => {
                const v = AQI_VISUALS[pt.level] ?? AQI_VISUALS.Unavailable
                return (
                  <div key={pt.timestamp} className="rounded-xl border border-[var(--ag-border)] p-2 text-center">
                    <div className="text-[11px] text-[var(--ag-muted)] tabular-nums">{pt.timestamp.slice(11, 16)}</div>
                    <div className="text-base font-bold tabular-nums" style={{ color: v.color }}>
                      {pt.predicted_aqi}
                    </div>
                    <div className="text-[10px] text-[var(--ag-muted)] tabular-nums">
                      {pt.uncertainty_low}–{pt.uncertainty_high}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Alerts + Community + Quick Chat */}
          <section className="ag-glass rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-amber-500" aria-hidden="true" />
                Active Predictive Alerts ({unreadAlerts.length})
              </h3>
              <button
                type="button"
                onClick={() => setActivePage('alerts')}
                className="text-xs font-semibold text-[var(--ag-accent)] hover:underline cursor-pointer"
              >
                All Alerts
              </button>
            </div>
            {alerts.slice(0, 2).map((a) => (
              <div key={a.id} className="rounded-xl border border-[var(--ag-border)] p-3 text-xs space-y-0.5">
                <div className="font-semibold">{a.title}</div>
                <div className="text-[var(--ag-muted)] line-clamp-2">{a.message}</div>
              </div>
            ))}
            {alerts.length === 0 ? (
              <p className="text-xs text-[var(--ag-muted)]">No active exceedance alerts for your threshold.</p>
            ) : null}

            <div className="pt-2 border-t border-[var(--ag-border)] flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 text-[var(--ag-muted)]">
                <Users className="w-3.5 h-3.5 text-[var(--ag-emerald)]" aria-hidden="true" />
                {community.campaign_headline}
              </span>
              <button
                type="button"
                onClick={() => setActivePage('community')}
                className="shrink-0 font-semibold text-[var(--ag-accent)] hover:underline cursor-pointer"
              >
                Join
              </button>
            </div>
          </section>

          <form onSubmit={handleQuickAsk} className="ag-glass rounded-3xl p-4 flex items-center gap-2">
            <label htmlFor="dash-quick-ask" className="visually-hidden">
              Ask the AI Air Quality Coordinator
            </label>
            <input
              id="dash-quick-ask"
              type="text"
              value={quickPrompt}
              onChange={(e) => setQuickPrompt(e.target.value)}
              placeholder="Ask e.g. 'Is the air safe today?'"
              className="flex-1 min-h-[40px] px-3 rounded-xl border border-[var(--ag-border)] bg-[var(--ag-surface-elevated)] text-sm"
            />
            <button
              type="submit"
              className="min-h-[40px] px-4 rounded-xl bg-[var(--ag-accent)] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
              Ask AI
            </button>
          </form>
        </div>
      </div>

      {/* Multi-Agent Execution Strip */}
      <section className="ag-glass rounded-3xl p-4" aria-label="Multi-Agent Coordinator Trace">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-[var(--ag-muted)]">
            watsonx Orchestrate Pipeline ({briefing.coordinator_agent_id})
          </span>
          <div className="flex flex-wrap gap-2">
            {agent_trace.map((step) => (
              <span
                key={step.agent_name}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ag-border)] px-3 py-1"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
                <span className="font-medium">{step.agent_name}</span>
                <span className="text-[var(--ag-muted)] tabular-nums">{step.latency_ms}ms</span>
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
