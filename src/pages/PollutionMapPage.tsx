import { PollutionMapWidget } from '../components/PollutionMapWidget'
import { AQI_VISUALS, formatTimestamp } from '../lib/aqiTheme'
import { useAirGuardStore } from '../store/useAirGuardStore'

export function PollutionMapPage() {
  const { briefing } = useAirGuardStore()
  if (!briefing) return null

  const { live_aqi } = briefing

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Interactive Air Pollution & Hotspot Map</h2>
        <p className="text-sm text-[var(--ag-muted)]">
          Inspect live station clusters, hotspot flags, dominant pollutants, and distance from {live_aqi.location.city}.
        </p>
      </div>

      <section className="ag-glass rounded-3xl p-6">
        <PollutionMapWidget location={live_aqi.location} hotspots={live_aqi.hotspots} heightClass="h-[460px]" />
      </section>

      <section className="ag-glass rounded-3xl p-6 space-y-4">
        <h3 className="text-base font-bold">Nearby Monitoring Stations ({live_aqi.hotspots.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <caption className="visually-hidden">Nearby monitoring stations and pollution hotspots</caption>
            <thead>
              <tr className="border-b border-[var(--ag-border)] text-[var(--ag-muted)]">
                <th scope="col" className="py-2.5 pr-4">Station</th>
                <th scope="col" className="py-2.5 pr-4">AQI</th>
                <th scope="col" className="py-2.5 pr-4">Category</th>
                <th scope="col" className="py-2.5 pr-4">Dominant</th>
                <th scope="col" className="py-2.5 pr-4">Source / Type</th>
                <th scope="col" className="py-2.5 pr-4">Distance</th>
                <th scope="col" className="py-2.5">Observed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ag-border)]">
              {live_aqi.hotspots.map((st) => {
                const v = AQI_VISUALS[st.level] ?? AQI_VISUALS.Unavailable
                return (
                  <tr key={st.station_id}>
                    <th scope="row" className="py-3 pr-4 font-semibold">
                      {st.name}
                      {st.is_hotspot ? (
                        <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-rose-500/15 text-rose-500">
                          Hotspot
                        </span>
                      ) : null}
                    </th>
                    <td className="py-3 pr-4 font-bold tabular-nums" style={{ color: v.color }}>
                      {st.aqi ?? '—'}
                    </td>
                    <td className="py-3 pr-4">{st.level}</td>
                    <td className="py-3 pr-4">{st.dominant_pollutant || '—'}</td>
                    <td className="py-3 pr-4 text-[var(--ag-muted)]">
                      {st.source_name} ({st.observation_type.replace('_', ' ')})
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      {st.distance_km !== null && st.distance_km !== undefined ? `${st.distance_km} km` : '—'}
                    </td>
                    <td className="py-3 text-[var(--ag-muted)]">{formatTimestamp(st.observed_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
