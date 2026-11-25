import { CheckCircle2, AlertTriangle, Database, Wind } from 'lucide-react'
import { AQIGaugeCard } from '../components/AQIGaugeCard'
import { formatTimestamp, getObservationBadge } from '../lib/aqiTheme'
import { useAirGuardStore } from '../store/useAirGuardStore'

export function LiveMonitoringPage() {
  const { briefing } = useAirGuardStore()
  if (!briefing) return null

  const { live_aqi } = briefing

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Live AQI Monitoring & Telemetry Validation</h2>
        <p className="text-sm text-[var(--ag-muted)]">
          Full pollutant audit distinguishing official monitoring stations from atmospheric model estimates.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 space-y-5">
          <AQIGaugeCard live={live_aqi} />

          {/* Validation Checks */}
          <section className="ag-glass rounded-3xl p-5 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Database className="w-4 h-4 text-[var(--ag-accent)]" aria-hidden="true" />
              Data Integrity & Source Audit
            </h3>
            <ul className="space-y-2 text-xs">
              {live_aqi.validation.checks_passed.map((c, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{c}</span>
                </li>
              ))}
              {live_aqi.validation.warnings.map((w, idx) => (
                <li key={idx} className="flex items-start gap-2 text-amber-500">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>

            {live_aqi.supplementary_sources.length > 0 ? (
              <div className="pt-3 border-t border-[var(--ag-border)] space-y-1.5 text-xs">
                <div className="font-semibold text-[var(--ag-muted)]">Supplementary Feeds</div>
                {live_aqi.supplementary_sources.map((src, i) => (
                  <div key={i} className="flex justify-between gap-2">
                    <span>{src.source_name}</span>
                    <span className="text-[var(--ag-muted)]">{src.observation_type.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </div>

        <div className="lg:col-span-7 space-y-5">
          <section className="ag-glass rounded-3xl p-6 space-y-4">
            <h3 className="text-base font-bold">All 8 Monitored & Audited Species</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {live_aqi.pollutants.map((p) => {
                const badge = getObservationBadge(p.observation_type)
                return (
                  <article key={p.code} className="rounded-2xl border border-[var(--ag-border)] p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-sm">{p.name}</div>
                        <div className="text-[11px] text-[var(--ag-muted)]">
                          WHO 24h Guideline: {p.who_guideline_24h || 'Not set'}
                        </div>
                      </div>
                      <span
                        className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
                        style={{ color: badge.tone, borderColor: `${badge.tone}44`, backgroundColor: `${badge.tone}15` }}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between">
                      <div className="text-2xl font-bold tabular-nums">
                        {p.available && p.value !== null ? p.value : 'Unavailable'}
                        <span className="ml-1.5 text-xs font-normal text-[var(--ag-muted)]">
                          {p.available ? p.unit : ''}
                        </span>
                      </div>
                      {p.sub_index !== null ? (
                        <span className="text-xs font-semibold tabular-nums text-[var(--ag-accent)]">
                          NAQI Sub-Index: {p.sub_index}
                        </span>
                      ) : null}
                    </div>

                    <div className="text-xs text-[var(--ag-muted)]">
                      {p.exceeds_who === true ? (
                        <span className="text-rose-500 font-semibold">Exceeds WHO 2021 24h guideline</span>
                      ) : p.exceeds_who === false ? (
                        <span className="text-emerald-500 font-semibold">Within WHO 2021 24h guideline</span>
                      ) : (
                        <span>{p.status_note}</span>
                      )}
                    </div>

                    <div className="text-[11px] text-[var(--ag-muted)] pt-1 border-t border-[var(--ag-border)] flex justify-between">
                      <span>{p.source_name}</span>
                      <span>{formatTimestamp(p.observed_at)}</span>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          {live_aqi.meteorology ? (
            <section className="ag-glass rounded-3xl p-5 space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Wind className="w-4 h-4 text-[var(--ag-accent)]" aria-hidden="true" />
                Meteorological Dispersion Context
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl border border-[var(--ag-border)] p-3">
                  <div className="text-[var(--ag-muted)]">Temperature</div>
                  <div className="text-lg font-bold tabular-nums">{live_aqi.meteorology.temperature_c ?? '—'} °C</div>
                </div>
                <div className="rounded-xl border border-[var(--ag-border)] p-3">
                  <div className="text-[var(--ag-muted)]">Relative Humidity</div>
                  <div className="text-lg font-bold tabular-nums">{live_aqi.meteorology.relative_humidity_pct ?? '—'}%</div>
                </div>
                <div className="rounded-xl border border-[var(--ag-border)] p-3">
                  <div className="text-[var(--ag-muted)]">Wind Speed</div>
                  <div className="text-lg font-bold tabular-nums">{live_aqi.meteorology.wind_speed_kmh ?? '—'} km/h</div>
                </div>
                <div className="rounded-xl border border-[var(--ag-border)] p-3">
                  <div className="text-[var(--ag-muted)]">Surface Pressure</div>
                  <div className="text-lg font-bold tabular-nums">{live_aqi.meteorology.surface_pressure_hpa ?? '—'} hPa</div>
                </div>
                <div className="rounded-xl border border-[var(--ag-border)] p-3">
                  <div className="text-[var(--ag-muted)]">Mineral Dust</div>
                  <div className="text-lg font-bold tabular-nums">{live_aqi.meteorology.dust_ugm3 ?? '—'} µg/m³</div>
                </div>
                <div className="rounded-xl border border-[var(--ag-border)] p-3">
                  <div className="text-[var(--ag-muted)]">UV Index</div>
                  <div className="text-lg font-bold tabular-nums">{live_aqi.meteorology.uv_index ?? '—'}</div>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}
