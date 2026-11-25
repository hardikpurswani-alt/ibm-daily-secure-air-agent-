import { AlertTriangle, Bot, CheckCircle2, Info } from 'lucide-react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CitationsDrawer } from '../components/CitationsDrawer'
import { AQI_VISUALS } from '../lib/aqiTheme'
import { useAirGuardStore } from '../store/useAirGuardStore'

export function ForecastPage() {
  const { briefing } = useAirGuardStore()
  if (!briefing) return null

  const { forecast } = briefing

  const chartData = forecast.forecasts.map((pt) => ({
    time: pt.timestamp.slice(5, 16).replace('T', ' '),
    predicted: pt.predicted_aqi,
    low: pt.uncertainty_low,
    high: pt.uncertainty_high,
    band: [pt.uncertainty_low, pt.uncertainty_high],
    confidence: pt.confidence_pct,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          {forecast.horizon_hours}-Hour Pollution Forecast & Uncertainty Analysis
        </h2>
        <p className="text-sm text-[var(--ag-muted)]">
          {forecast.source_name} · Trend: <strong className="capitalize text-[var(--ag-text)]">{forecast.trend_direction}</strong>
        </p>
      </div>

      {/* Granite Reasoning + Confidence Disclaimer */}
      <section className="ag-glass rounded-3xl p-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--ag-accent)] flex items-center gap-1.5">
            <Bot className="w-4 h-4" aria-hidden="true" />
            Forecasting Agent Reasoning ({forecast.reasoning_mode === 'ibm_watsonx_granite' ? 'IBM Granite' : 'Evidence Synthesis'})
          </div>
          <span className="text-xs px-3 py-1 rounded-full border border-[var(--ag-border)]">
            Probabilistic Model (Not Guaranteed)
          </span>
        </div>
        <p className="text-sm leading-relaxed">{forecast.granite_reasoning}</p>
        <p className="text-xs text-[var(--ag-muted)] flex items-start gap-1.5">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-[var(--ag-accent)]" aria-hidden="true" />
          <span>{forecast.confidence_note}</span>
        </p>
      </section>

      {/* Uncertainty Band Chart */}
      <section className="ag-glass rounded-3xl p-6 space-y-4">
        <h3 className="text-base font-bold">Predicted AQI Trajectory with Uncertainty Range</h3>
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'var(--ag-muted)' }} minTickGap={34} />
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
              <ReferenceLine y={100} stroke="#eab308" strokeDasharray="4 4" strokeOpacity={0.5} />
              <ReferenceLine y={150} stroke="#ea580c" strokeDasharray="4 4" strokeOpacity={0.5} />
              <Area
                type="monotone"
                dataKey="high"
                name="Upper Uncertainty Bound"
                stroke="#38bdf8"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                fill="#0284c7"
                fillOpacity={0.12}
              />
              <Line
                type="monotone"
                dataKey="low"
                name="Lower Uncertainty Bound"
                stroke="#38bdf8"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="predicted"
                name="Expected Predicted AQI"
                stroke="#0284c7"
                strokeWidth={2.5}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Unhealthy Windows & Preventive Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="ag-glass rounded-3xl p-6 space-y-3">
          <h3 className="text-base font-bold">Potentially Unhealthy Windows</h3>
          {forecast.unhealthy_windows.length === 0 ? (
            <p className="text-sm text-emerald-500 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              No AQI windows above 100 projected in the next {forecast.horizon_hours} hours.
            </p>
          ) : (
            <div className="space-y-3">
              {forecast.unhealthy_windows.map((win, idx) => {
                const v = AQI_VISUALS[win.level] ?? AQI_VISUALS.Moderate
                return (
                  <article key={idx} className="rounded-2xl border p-4 space-y-1.5" style={{ borderColor: v.border, backgroundColor: v.softBg }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold flex items-center gap-1.5" style={{ color: v.color }}>
                        <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                        Peak ~{win.peak_aqi} ({win.level})
                      </span>
                      <span className="text-xs font-medium tabular-nums">
                        {win.start_time.slice(5, 16).replace('T', ' ')} → {win.end_time.slice(11, 16)}
                      </span>
                    </div>
                    <p className="text-xs">{win.summary}</p>
                    <p className="text-xs text-[var(--ag-muted)]">{win.preventive_action}</p>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section className="ag-glass rounded-3xl p-6 space-y-3">
          <h3 className="text-base font-bold">Preventive Scheduling Guidance</h3>
          <ul className="space-y-2.5 text-sm">
            {forecast.preventive_recommendations.map((rec, i) => (
              <li key={i} className="rounded-2xl border border-[var(--ag-border)] px-4 py-3 text-xs leading-relaxed">
                {rec}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <CitationsDrawer citations={forecast.citations} title="Forecasting & Dispersion Guideline Sources" />
    </div>
  )
}
