import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import { Flame, MapPin } from 'lucide-react'
import { AQI_VISUALS, formatTimestamp, getObservationBadge } from '../lib/aqiTheme'
import type { HotspotStation, LocationInfo } from '../types/airguard'

interface Props {
  location: LocationInfo
  hotspots: HotspotStation[]
  heightClass?: string
}

function RecenterMap({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lon], 10, { animate: true })
  }, [lat, lon, map])
  return null
}

export function PollutionMapWidget({ location, hotspots, heightClass = 'h-[360px]' }: Props) {
  const [onlyHotspots, setOnlyHotspots] = useState(false)

  const filtered = useMemo(() => {
    if (!onlyHotspots) return hotspots
    const elevated = hotspots.filter((h) => h.is_hotspot)
    return elevated.length > 0 ? elevated : hotspots
  }, [hotspots, onlyHotspots])

  const hotspotCount = hotspots.filter((h) => h.is_hotspot).length

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-[var(--ag-muted)]">
          <MapPin className="w-4 h-4 text-[var(--ag-accent)]" aria-hidden="true" />
          <span>
            Showing <strong className="text-[var(--ag-text)]">{filtered.length}</strong> monitoring point(s) ·{' '}
            <strong className="text-[var(--ag-text)]">{hotspotCount}</strong> elevated hotspot(s)
          </span>
        </div>

        <div className="inline-flex rounded-full border border-[var(--ag-border)] p-0.5 text-xs" role="group" aria-label="Station map filter">
          <button
            type="button"
            onClick={() => setOnlyHotspots(false)}
            aria-pressed={!onlyHotspots}
            className={`px-3 py-1 rounded-full font-medium transition cursor-pointer ${
              !onlyHotspots ? 'bg-[var(--ag-accent)] text-white' : 'text-[var(--ag-muted)] hover:text-[var(--ag-text)]'
            }`}
          >
            All Stations ({hotspots.length})
          </button>
          <button
            type="button"
            onClick={() => setOnlyHotspots(true)}
            aria-pressed={onlyHotspots}
            className={`px-3 py-1 rounded-full font-medium transition inline-flex items-center gap-1 cursor-pointer ${
              onlyHotspots ? 'bg-amber-600 text-white' : 'text-[var(--ag-muted)] hover:text-[var(--ag-text)]'
            }`}
          >
            <Flame className="w-3.5 h-3.5" aria-hidden="true" />
            Hotspots ({hotspotCount})
          </button>
        </div>
      </div>

      <div className={`w-full overflow-hidden rounded-2xl border border-[var(--ag-border)] ${heightClass}`}>
        <MapContainer
          center={[location.latitude, location.longitude]}
          zoom={10}
          className="w-full h-full z-0"
          scrollWheelZoom={false}
          aria-label={`Air pollution monitoring map for ${location.city}`}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
          />
          <RecenterMap lat={location.latitude} lon={location.longitude} />

          {filtered.map((st) => {
            const visual = AQI_VISUALS[st.level] ?? AQI_VISUALS.Unavailable
            const obs = getObservationBadge(st.observation_type)
            return (
              <CircleMarker
                key={st.station_id}
                center={[st.latitude, st.longitude]}
                radius={st.is_hotspot ? 13 : 10}
                pathOptions={{
                  fillColor: visual.color,
                  fillOpacity: 0.85,
                  color: st.is_hotspot ? '#ffffff' : visual.color,
                  weight: st.is_hotspot ? 2.5 : 1.5,
                }}
              >
                <Popup>
                  <div className="min-w-[200px] text-slate-900 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-base tabular-nums" style={{ color: visual.color }}>
                        AQI {st.aqi ?? '—'}
                      </span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {obs.label}
                      </span>
                    </div>
                    <div className="font-semibold text-sm">{st.name}</div>
                    <div className="text-xs text-slate-600">
                      {st.level} · Dominant: {st.dominant_pollutant || 'N/A'}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Source: {st.source_name}
                      {st.distance_km !== null && st.distance_km !== undefined ? ` · ${st.distance_km} km away` : ''}
                    </div>
                    <div className="text-[11px] text-slate-500">Observed: {formatTimestamp(st.observed_at)}</div>
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-[var(--ag-muted)]" role="list" aria-label="AQI Map Color Legend">
        {(['Good', 'Moderate', 'Unhealthy for Sensitive Groups', 'Unhealthy', 'Very Unhealthy', 'Hazardous'] as const).map(
          (lvl) => (
            <div key={lvl} role="listitem" className="inline-flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: AQI_VISUALS[lvl].color }}
                aria-hidden="true"
              />
              <span>{lvl}</span>
            </div>
          ),
        )}
      </div>
    </div>
  )
}
