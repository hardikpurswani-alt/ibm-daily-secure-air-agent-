// ─────────────────────────────────────────────────────────────────────────────
// AQI Pollution Map — Interactive Leaflet map with station markers
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { AQIReading, MapStation } from '../agents/types';

interface PollutionMapProps {
  reading: AQIReading | null;
  isLoading: boolean;
}

const AQI_COLORS: Record<string, string> = {
  Good: '#22c55e',
  Moderate: '#eab308',
  'Unhealthy for Sensitive Groups': '#f97316',
  Unhealthy: '#ef4444',
  'Very Unhealthy': '#a855f7',
  Hazardous: '#dc2626',
};

function MapController({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], 10);
  }, [lat, lon, map]);
  return null;
}

export function PollutionMap({ reading, isLoading }: PollutionMapProps) {
  const stations = (window as Window & { __aqStations?: MapStation[] }).__aqStations ?? [];

  const lat = reading?.location.lat ?? 40.7128;
  const lon = reading?.location.lon ?? -74.006;

  if (isLoading && !reading) {
    return (
      <div className="skeleton" style={{ height: 380, borderRadius: 10 }} />
    );
  }

  return (
    <div style={styles.wrapper}>
      <MapContainer
        center={[lat, lon]}
        zoom={10}
        style={styles.map}
        scrollWheelZoom={false}
        aria-label="Air quality pollution map"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
        />
        <MapController lat={lat} lon={lon} />

        {/* Current location marker */}
        {reading && (
          <CircleMarker
            center={[lat, lon]}
            radius={18}
            pathOptions={{
              fillColor: AQI_COLORS[reading.level] ?? '#3b82f6',
              fillOpacity: 0.9,
              color: '#fff',
              weight: 2,
            }}
          >
            <Popup>
              <div style={{ fontFamily: 'Fira Sans, sans-serif', minWidth: 160 }}>
                <strong style={{ color: AQI_COLORS[reading.level], fontFamily: 'Fira Code, monospace', fontSize: 18 }}>
                  AQI {reading.aqi}
                </strong>
                <div style={{ fontSize: 13, marginTop: 4 }}>{reading.level}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{reading.location.city}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                  Dominant: {reading.dominantPollutant}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        )}

        {/* Nearby stations */}
        {stations.map((station) => (
          <CircleMarker
            key={station.id}
            center={[station.lat, station.lon]}
            radius={10}
            pathOptions={{
              fillColor: AQI_COLORS[station.level] ?? '#3b82f6',
              fillOpacity: 0.75,
              color: AQI_COLORS[station.level] ?? '#3b82f6',
              weight: 1,
            }}
          >
            <Popup>
              <div style={{ fontFamily: 'Fira Sans, sans-serif', minWidth: 140 }}>
                <strong style={{ fontFamily: 'Fira Code, monospace', color: AQI_COLORS[station.level], fontSize: 16 }}>
                  AQI {station.aqi}
                </strong>
                <div style={{ fontSize: 12, marginTop: 4 }}>{station.level}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{station.name}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* Legend */}
      <div style={styles.legend} role="list" aria-label="AQI color legend">
        {Object.entries(AQI_COLORS).map(([level, color]) => (
          <div key={level} role="listitem" style={styles.legendItem}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} aria-hidden />
            <span style={styles.legendLabel}>{level}</span>
          </div>
        ))}
      </div>

      {/* Station count */}
      <div style={styles.stationCount}>
        <span aria-live="polite">
          {stations.length > 0
            ? `${stations.length} monitoring stations loaded`
            : 'Loading nearby stations...'}
        </span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  map: {
    height: 380,
    borderRadius: 10,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  legendLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontFamily: 'Fira Code, monospace',
  },
  stationCount: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    fontFamily: 'Fira Code, monospace',
  },
};
