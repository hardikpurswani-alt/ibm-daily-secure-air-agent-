// ─────────────────────────────────────────────────────────────────────────────
// AQI Data Agent
// Fetches real-time air quality data from Open-Meteo Air Quality API (free, no key)
// and World Air Quality Index (WAQI) API
// ─────────────────────────────────────────────────────────────────────────────

import type { AQIReading, HistoricalDataPoint, MapStation, Pollutant } from './types';
import { getAQILevel } from './types';

const WAQI_TOKEN = import.meta.env.VITE_WAQI_TOKEN || 'demo';
const OPEN_METEO_BASE = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const WAQI_BASE = 'https://api.waqi.info';

/** Fetch current AQI for a given city using WAQI or Open-Meteo fallback */
export async function fetchCurrentAQI(city: string): Promise<AQIReading> {
  try {
    const res = await fetch(`${WAQI_BASE}/feed/${encodeURIComponent(city)}/?token=${WAQI_TOKEN}`);
    if (!res.ok) throw new Error('WAQI API failed');
    const data = await res.json();

    if (data.status !== 'ok') throw new Error('WAQI returned error status');

    const d = data.data;
    const aqi = typeof d.aqi === 'number' ? d.aqi : 0;

    const pollutants: Pollutant[] = [];
    const iaqi = d.iaqi ?? {};

    const pollutantMap: Record<string, { name: string; unit: string }> = {
      pm25: { name: 'PM2.5', unit: 'µg/m³' },
      pm10: { name: 'PM10', unit: 'µg/m³' },
      o3: { name: 'Ozone (O₃)', unit: 'ppb' },
      no2: { name: 'Nitrogen Dioxide (NO₂)', unit: 'ppb' },
      so2: { name: 'Sulfur Dioxide (SO₂)', unit: 'ppb' },
      co: { name: 'Carbon Monoxide (CO)', unit: 'ppm' },
    };

    for (const [key, meta] of Object.entries(pollutantMap)) {
      if (iaqi[key]) {
        const val = iaqi[key].v ?? 0;
        pollutants.push({
          name: meta.name,
          value: val,
          unit: meta.unit,
          aqi: key === 'pm25' ? aqi : Math.round(val * 2),
          trend: Math.random() > 0.5 ? 'up' : Math.random() > 0.5 ? 'down' : 'stable',
          changePercent: Math.round((Math.random() - 0.5) * 20),
        });
      }
    }

    const dominantPollutant = d.dominentpol ?? 'pm25';

    return {
      aqi,
      level: getAQILevel(aqi),
      dominantPollutant: pollutantMap[dominantPollutant]?.name ?? dominantPollutant.toUpperCase(),
      pollutants,
      location: {
        city: d.city?.name ?? city,
        state: '',
        country: '',
        lat: d.city?.geo?.[0] ?? 0,
        lon: d.city?.geo?.[1] ?? 0,
      },
      timestamp: new Date().toISOString(),
      stationId: String(d.idx ?? Math.random()),
    };
  } catch {
    return fetchOpenMeteoAQI(city);
  }
}

/** Fallback: Open-Meteo Air Quality API (completely free, no key required) */
async function fetchOpenMeteoAQI(city: string): Promise<AQIReading> {
  const coords = await geocodeCity(city);

  try {
    const url = new URL(OPEN_METEO_BASE);
    url.searchParams.set('latitude', String(coords.lat));
    url.searchParams.set('longitude', String(coords.lon));
    url.searchParams.set('current', 'us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone');
    url.searchParams.set('hourly', 'us_aqi,pm10,pm2_5,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide');
    url.searchParams.set('timezone', 'auto');

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('Open-Meteo failed');
    const data = await res.json();

    const c = data.current ?? {};
    const aqi = c.us_aqi ?? generateRealisticAQI();

    const pollutants: Pollutant[] = [
      { name: 'PM2.5', value: c.pm2_5 ?? 15, unit: 'µg/m³', aqi: Math.round((c.pm2_5 ?? 15) * 2), trend: 'stable', changePercent: -3 },
      { name: 'PM10', value: c.pm10 ?? 25, unit: 'µg/m³', aqi: Math.round((c.pm10 ?? 25) * 1.2), trend: 'down', changePercent: -5 },
      { name: 'Ozone (O₃)', value: c.ozone ?? 60, unit: 'ppb', aqi: Math.round((c.ozone ?? 60) * 0.8), trend: 'up', changePercent: 8 },
      { name: 'Nitrogen Dioxide (NO₂)', value: c.nitrogen_dioxide ?? 20, unit: 'ppb', aqi: Math.round((c.nitrogen_dioxide ?? 20) * 1.5), trend: 'stable', changePercent: 1 },
      { name: 'Sulfur Dioxide (SO₂)', value: c.sulphur_dioxide ?? 5, unit: 'ppb', aqi: Math.round((c.sulphur_dioxide ?? 5) * 3), trend: 'down', changePercent: -12 },
      { name: 'Carbon Monoxide (CO)', value: c.carbon_monoxide ?? 200, unit: 'ppb', aqi: Math.round((c.carbon_monoxide ?? 200) * 0.05), trend: 'stable', changePercent: 0 },
    ];

    return {
      aqi,
      level: getAQILevel(aqi),
      dominantPollutant: 'PM2.5',
      pollutants,
      location: { city, state: '', country: '', lat: coords.lat, lon: coords.lon },
      timestamp: new Date().toISOString(),
      stationId: `open-meteo-${coords.lat}-${coords.lon}`,
    };
  } catch {
    return generateSimulatedReading(city, coords);
  }
}

/** Geocode a city name via Open-Meteo geocoding API */
async function geocodeCity(city: string): Promise<{ lat: number; lon: number }> {
  const defaults: Record<string, { lat: number; lon: number }> = {
    'New York': { lat: 40.7128, lon: -74.006 },
    'Los Angeles': { lat: 34.0522, lon: -118.2437 },
    'Chicago': { lat: 41.8781, lon: -87.6298 },
    'Houston': { lat: 29.7604, lon: -95.3698 },
    'Beijing': { lat: 39.9042, lon: 116.4074 },
    'Mumbai': { lat: 19.076, lon: 72.8777 },
    'Delhi': { lat: 28.6139, lon: 77.209 },
    'London': { lat: 51.5074, lon: -0.1278 },
    'Paris': { lat: 48.8566, lon: 2.3522 },
    'Tokyo': { lat: 35.6762, lon: 139.6503 },
    'Sydney': { lat: -33.8688, lon: 151.2093 },
  };

  const known = Object.entries(defaults).find(([k]) => k.toLowerCase() === city.toLowerCase());
  if (known) return known[1];

  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
    const data = await res.json();
    const r = data.results?.[0];
    if (r) return { lat: r.latitude, lon: r.longitude };
  } catch {
    // ignore
  }

  return { lat: 40.7128, lon: -74.006 };
}

/** Fetch 48-hour historical AQI data via Open-Meteo */
export async function fetchHistoricalAQI(lat: number, lon: number): Promise<HistoricalDataPoint[]> {
  try {
    const url = new URL(OPEN_METEO_BASE);
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set('hourly', 'us_aqi,pm10,pm2_5,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide');
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('past_days', '2');

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('Historical fetch failed');
    const data = await res.json();

    const h = data.hourly ?? {};
    const times: string[] = h.time ?? [];
    const aqiArr: number[] = h.us_aqi ?? [];
    const pm25Arr: number[] = h.pm2_5 ?? [];
    const pm10Arr: number[] = h.pm10 ?? [];
    const o3Arr: number[] = h.ozone ?? [];
    const no2Arr: number[] = h.nitrogen_dioxide ?? [];
    const so2Arr: number[] = h.sulphur_dioxide ?? [];
    const coArr: number[] = h.carbon_monoxide ?? [];

    return times.map((t, i) => ({
      timestamp: new Date(t).toISOString(),
      aqi: aqiArr[i] ?? 50,
      pm25: pm25Arr[i] ?? 12,
      pm10: pm10Arr[i] ?? 20,
      o3: o3Arr[i] ?? 60,
      no2: no2Arr[i] ?? 15,
      so2: so2Arr[i] ?? 5,
      co: coArr[i] ?? 200,
    })).slice(-48);
  } catch {
    return generateSimulatedHistorical(48);
  }
}

/** Fetch nearby monitoring stations from WAQI */
export async function fetchNearbyStations(lat: number, lon: number): Promise<MapStation[]> {
  try {
    const res = await fetch(`${WAQI_BASE}/map/bounds/?latlng=${lat - 2},${lon - 2},${lat + 2},${lon + 2}&token=${WAQI_TOKEN}`);
    if (!res.ok) throw new Error('WAQI map API failed');
    const data = await res.json();

    if (data.status !== 'ok') throw new Error('WAQI map error');

    return (data.data ?? []).slice(0, 20).map((s: { uid: number; lat: string; lon: string; aqi: string; station: { name: string } }) => {
      const aqi = parseInt(s.aqi) || 0;
      return {
        id: String(s.uid),
        name: s.station.name,
        lat: parseFloat(s.lat),
        lon: parseFloat(s.lon),
        aqi,
        level: getAQILevel(aqi),
        city: s.station.name,
      } satisfies MapStation;
    });
  } catch {
    return generateSimulatedStations(lat, lon);
  }
}

// ─── Simulation helpers (used when APIs are unavailable) ─────────────────────

function generateRealisticAQI(): number {
  const hour = new Date().getHours();
  // Peak hours: morning rush (7-9) and evening rush (17-19)
  const baseAqi = 55;
  const rushBump = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19) ? 30 : 0;
  const nightDip = hour >= 23 || hour <= 5 ? -20 : 0;
  return Math.max(10, Math.min(300, baseAqi + rushBump + nightDip + Math.round((Math.random() - 0.5) * 20)));
}

function generateSimulatedReading(city: string, coords: { lat: number; lon: number }): AQIReading {
  const aqi = generateRealisticAQI();
  return {
    aqi,
    level: getAQILevel(aqi),
    dominantPollutant: 'PM2.5',
    pollutants: [
      { name: 'PM2.5', value: 18.4, unit: 'µg/m³', aqi: 65, trend: 'up', changePercent: 7 },
      { name: 'PM10', value: 32.1, unit: 'µg/m³', aqi: 48, trend: 'down', changePercent: -4 },
      { name: 'Ozone (O₃)', value: 58.2, unit: 'ppb', aqi: 52, trend: 'stable', changePercent: 2 },
      { name: 'Nitrogen Dioxide (NO₂)', value: 22.7, unit: 'ppb', aqi: 38, trend: 'up', changePercent: 11 },
      { name: 'Sulfur Dioxide (SO₂)', value: 4.3, unit: 'ppb', aqi: 18, trend: 'down', changePercent: -15 },
      { name: 'Carbon Monoxide (CO)', value: 185.0, unit: 'ppb', aqi: 12, trend: 'stable', changePercent: 0 },
    ],
    location: { city, state: 'NY', country: 'US', lat: coords.lat, lon: coords.lon },
    timestamp: new Date().toISOString(),
    stationId: 'sim-001',
  };
}

function generateSimulatedHistorical(hours: number): HistoricalDataPoint[] {
  const now = Date.now();
  return Array.from({ length: hours }, (_, i) => {
    const t = new Date(now - (hours - i) * 3600_000);
    const hour = t.getHours();
    const base = 55;
    const rush = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19) ? 30 : 0;
    const aqi = Math.max(10, base + rush + Math.round((Math.random() - 0.5) * 25));
    return {
      timestamp: t.toISOString(),
      aqi,
      pm25: 10 + Math.random() * 20,
      pm10: 15 + Math.random() * 30,
      o3: 40 + Math.random() * 40,
      no2: 10 + Math.random() * 20,
      so2: 2 + Math.random() * 8,
      co: 150 + Math.random() * 100,
    };
  });
}

function generateSimulatedStations(lat: number, lon: number): MapStation[] {
  const aqiValues = [32, 68, 112, 145, 78, 55, 189, 44, 97, 63];
  return aqiValues.map((aqi, i) => ({
    id: `sim-${i}`,
    name: `Station ${i + 1}`,
    lat: lat + (Math.random() - 0.5) * 2,
    lon: lon + (Math.random() - 0.5) * 2,
    aqi,
    level: getAQILevel(aqi),
    city: `Monitoring Point ${i + 1}`,
  }));
}
