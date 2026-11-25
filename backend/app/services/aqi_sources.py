"""Real-time AQI, meteorological, and government station adapters with strict provenance."""

from __future__ import annotations

import logging
import math
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx

from ..core.config import get_settings
from ..schemas.airguard import (
    AQILevel,
    FreshnessLevel,
    HistoricalPoint,
    HotspotStation,
    LocationInfo,
    LocationSuggestion,
    MeteorologyContext,
    PollutantReading,
    SourceAttribution,
)

logger = logging.getLogger("airguard.aqi_sources")

OPEN_METEO_AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
OPEN_METEO_WEATHER_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
CPCB_RSS_URL = "https://airquality.cpcb.gov.in/caaqms/rss_feed"
NSW_SITE_DETAILS_URL = "https://data.airquality.nsw.gov.au/api/Data/get_SiteDetails"
WAQI_BASE_URL = "https://api.waqi.info"
OPENAQ_BASE_URL = "https://api.openaq.org/v3"

# Verified fallback coordinate catalog only used if geocoding upstream times out
KNOWN_LOCATIONS: Dict[str, LocationSuggestion] = {
    "delhi": LocationSuggestion(name="Delhi", region="NCT Delhi", country="India", country_code="IN", latitude=28.65195, longitude=77.23149, timezone="Asia/Kolkata"),
    "new delhi": LocationSuggestion(name="New Delhi", region="NCT Delhi", country="India", country_code="IN", latitude=28.6139, longitude=77.2090, timezone="Asia/Kolkata"),
    "mumbai": LocationSuggestion(name="Mumbai", region="Maharashtra", country="India", country_code="IN", latitude=19.0760, longitude=72.8777, timezone="Asia/Kolkata"),
    "bengaluru": LocationSuggestion(name="Bengaluru", region="Karnataka", country="India", country_code="IN", latitude=12.9716, longitude=77.5946, timezone="Asia/Kolkata"),
    "bangalore": LocationSuggestion(name="Bengaluru", region="Karnataka", country="India", country_code="IN", latitude=12.9716, longitude=77.5946, timezone="Asia/Kolkata"),
    "chennai": LocationSuggestion(name="Chennai", region="Tamil Nadu", country="India", country_code="IN", latitude=13.0827, longitude=80.2707, timezone="Asia/Kolkata"),
    "kolkata": LocationSuggestion(name="Kolkata", region="West Bengal", country="India", country_code="IN", latitude=22.5726, longitude=88.3639, timezone="Asia/Kolkata"),
    "hyderabad": LocationSuggestion(name="Hyderabad", region="Telangana", country="India", country_code="IN", latitude=17.3850, longitude=78.4867, timezone="Asia/Kolkata"),
    "pune": LocationSuggestion(name="Pune", region="Maharashtra", country="India", country_code="IN", latitude=18.5204, longitude=73.8567, timezone="Asia/Kolkata"),
    "sydney": LocationSuggestion(name="Sydney", region="New South Wales", country="Australia", country_code="AU", latitude=-33.8688, longitude=151.2093, timezone="Australia/Sydney"),
    "melbourne": LocationSuggestion(name="Melbourne", region="Victoria", country="Australia", country_code="AU", latitude=-37.8136, longitude=144.9631, timezone="Australia/Melbourne"),
    "new york": LocationSuggestion(name="New York", region="New York", country="United States", country_code="US", latitude=40.7128, longitude=-74.0060, timezone="America/New_York"),
    "los angeles": LocationSuggestion(name="Los Angeles", region="California", country="United States", country_code="US", latitude=34.0522, longitude=-118.2437, timezone="America/Los_Angeles"),
    "london": LocationSuggestion(name="London", region="England", country="United Kingdom", country_code="GB", latitude=51.5074, longitude=-0.1278, timezone="Europe/London"),
    "tokyo": LocationSuggestion(name="Tokyo", region="Tokyo", country="Japan", country_code="JP", latitude=35.6762, longitude=139.6503, timezone="Asia/Tokyo"),
    "singapore": LocationSuggestion(name="Singapore", region="Central", country="Singapore", country_code="SG", latitude=1.3521, longitude=103.8198, timezone="Asia/Singapore"),
}

_cpcb_cache: Tuple[float, List[Dict[str, Any]]] = (0.0, [])
_nsw_sites_cache: Tuple[float, List[Dict[str, Any]]] = (0.0, [])


def aqi_to_level(aqi: Optional[int]) -> AQILevel:
    """Map numeric AQI (0–500) to standard health category."""
    if aqi is None:
        return "Unavailable"
    if aqi <= 50:
        return "Good"
    if aqi <= 100:
        return "Moderate"
    if aqi <= 150:
        return "Unhealthy for Sensitive Groups"
    if aqi <= 200:
        return "Unhealthy"
    if aqi <= 300:
        return "Very Unhealthy"
    return "Hazardous"


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Compute great-circle distance in kilometers."""
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 2)


def compute_freshness(observed_at: Optional[str]) -> Tuple[FreshnessLevel, Optional[int]]:
    """Evaluate freshness of an ISO timestamp relative to UTC now."""
    if not observed_at:
        return "unavailable", None
    try:
        dt = datetime.fromisoformat(observed_at.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        mins = max(0, int((datetime.now(timezone.utc) - dt.astimezone(timezone.utc)).total_seconds() // 60))
        if mins <= 120:
            return "fresh", mins
        if mins <= 480:
            return "aging", mins
        return "stale", mins
    except Exception:
        return "aging", None


async def search_locations(query: str, count: int = 6) -> List[LocationSuggestion]:
    """Search global cities via Open-Meteo Geocoding API."""
    q = query.strip()
    if not q:
        return list(KNOWN_LOCATIONS.values())[:count]

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(OPEN_METEO_GEOCODE_URL, params={"name": q, "count": count, "language": "en", "format": "json"})
            resp.raise_for_status()
            data = resp.json()
            results = data.get("results") or []
            if results:
                return [
                    LocationSuggestion(
                        name=r.get("name", q),
                        region=r.get("admin1", "") or "",
                        country=r.get("country", "") or "",
                        country_code=r.get("country_code", "") or "",
                        latitude=float(r["latitude"]),
                        longitude=float(r["longitude"]),
                        timezone=r.get("timezone", "UTC") or "UTC",
                    )
                    for r in results
                ]
    except Exception as exc:  # noqa: BLE001
        logger.warning("Geocoding upstream error for '%s': %s", q, exc)

    # Fallback local match only against known coordinate catalog
    matches = [loc for key, loc in KNOWN_LOCATIONS.items() if q.lower() in key or q.lower() in loc.name.lower()]
    return matches[:count]


async def resolve_location(city: str, lat: Optional[float] = None, lon: Optional[float] = None) -> LocationInfo:
    """Resolve city name or explicit coordinates into standardized LocationInfo."""
    if lat is not None and lon is not None:
        return LocationInfo(
            query=city or f"{lat:.4f},{lon:.4f}",
            city=city or f"Coordinates ({lat:.2f}, {lon:.2f})",
            latitude=lat,
            longitude=lon,
            timezone="UTC",
        )

    cleaned = city.strip()
    known = KNOWN_LOCATIONS.get(cleaned.lower())
    suggestions = await search_locations(cleaned, count=1)
    if suggestions:
        top = suggestions[0]
        return LocationInfo(
            query=cleaned,
            city=top.name,
            region=top.region,
            country=top.country,
            latitude=top.latitude,
            longitude=top.longitude,
            timezone=top.timezone,
        )
    if known:
        return LocationInfo(
            query=cleaned,
            city=known.name,
            region=known.region,
            country=known.country,
            latitude=known.latitude,
            longitude=known.longitude,
            timezone=known.timezone,
        )
    raise ValueError(f"Could not resolve location '{city}'. Try a major city name or provide coordinates.")


async def fetch_cpcb_stations() -> List[Dict[str, Any]]:
    """Fetch and parse live official India CPCB CAAQMS RSS stations (560+ stations, cached 10 min)."""
    global _cpcb_cache
    now = time.time()
    if _cpcb_cache[1] and (now - _cpcb_cache[0]) < 600:
        return _cpcb_cache[1]

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.get(CPCB_RSS_URL)
            resp.raise_for_status()
            root = ET.fromstring(resp.text)
    except Exception as exc:  # noqa: BLE001
        logger.warning("CPCB feed unavailable: %s", exc)
        return _cpcb_cache[1]

    parsed: List[Dict[str, Any]] = []
    for state_el in root.findall(".//State"):
        state_name = state_el.attrib.get("id", "")
        for city_el in state_el.findall("./City"):
            city_name = city_el.attrib.get("id", "")
            for st in city_el.findall("./Station"):
                try:
                    lat = float(st.attrib.get("latitude", ""))
                    lon = float(st.attrib.get("longitude", ""))
                except ValueError:
                    continue

                last_upd_raw = st.attrib.get("lastupdate", "")
                observed_iso = None
                if last_upd_raw:
                    try:
                        # Format: DD-MM-YYYY HH:MM:SS (IST +05:30)
                        dt = datetime.strptime(last_upd_raw.strip(), "%d-%m-%Y %H:%M:%S")
                        observed_iso = dt.strftime("%Y-%m-%dT%H:%M:%S+05:30")
                    except ValueError:
                        observed_iso = None

                aqi_el = st.find("Air_Quality_Index")
                aqi_val = None
                predom = None
                if aqi_el is not None:
                    raw_aqi = aqi_el.attrib.get("Value", "")
                    if raw_aqi.isdigit():
                        aqi_val = int(raw_aqi)
                    predom = aqi_el.attrib.get("Predominant_Parameter")

                sub_indices: Dict[str, Optional[int]] = {}
                for pol in st.findall("Pollutant_Index"):
                    pid = pol.attrib.get("id", "").upper()
                    avg = pol.attrib.get("Avg", "")
                    h_sub = pol.attrib.get("Hourly_sub_index", "")
                    val = None
                    if avg.isdigit():
                        val = int(avg)
                    elif h_sub.isdigit():
                        val = int(h_sub)
                    if pid:
                        sub_indices[pid] = val

                parsed.append(
                    {
                        "station_id": st.attrib.get("id", "CPCB-Station"),
                        "name": st.attrib.get("id", "CPCB-Station"),
                        "city": city_name,
                        "state": state_name,
                        "latitude": lat,
                        "longitude": lon,
                        "aqi": aqi_val,
                        "predominant_parameter": predom,
                        "sub_indices": sub_indices,
                        "observed_at": observed_iso,
                    }
                )

    if parsed:
        _cpcb_cache = (now, parsed)
    return parsed


async def fetch_nsw_sites() -> List[Dict[str, Any]]:
    """Fetch official NSW Government Air Quality site list (Sydney/NSW Australia)."""
    global _nsw_sites_cache
    now = time.time()
    if _nsw_sites_cache[1] and (now - _nsw_sites_cache[0]) < 3600:
        return _nsw_sites_cache[1]

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(NSW_SITE_DETAILS_URL)
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, list):
                _nsw_sites_cache = (now, data)
                return data
    except Exception as exc:  # noqa: BLE001
        logger.warning("NSW EPA site metadata unavailable: %s", exc)
    return _nsw_sites_cache[1]


async def fetch_open_meteo_bundle(lat: float, lon: float) -> Dict[str, Any]:
    """Fetch live Open-Meteo Air Quality (current + 48h history + 72h forecast) and Meteorology."""
    air_params = {
        "latitude": lat,
        "longitude": lon,
        "current": "us_aqi,european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,ammonia,dust,uv_index",
        "hourly": "us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,ammonia",
        "past_days": 2,
        "forecast_days": 3,
        "timezone": "auto",
    }
    weather_params = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,surface_pressure",
        "timezone": "auto",
    }

    async with httpx.AsyncClient(timeout=12.0) as client:
        air_resp = await client.get(OPEN_METEO_AIR_URL, params=air_params)
        air_resp.raise_for_status()
        air_data = air_resp.json()

        weather_data: Dict[str, Any] = {}
        try:
            w_resp = await client.get(OPEN_METEO_WEATHER_URL, params=weather_params)
            if w_resp.status_code == 200:
                weather_data = w_resp.json()
        except Exception:
            weather_data = {}

    return {"air": air_data, "weather": weather_data}


async def fetch_optional_waqi(lat: float, lon: float) -> Optional[Dict[str, Any]]:
    """Query WAQI station ONLY if a non-demo API token is configured."""
    settings = get_settings()
    if not settings.has_valid_waqi_token:
        return None
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                f"{WAQI_BASE_URL}/feed/geo:{lat};{lon}/",
                params={"token": settings.waqi_api_token},
            )
            if resp.status_code != 200:
                return None
            payload = resp.json()
            if payload.get("status") != "ok":
                return None
            d = payload.get("data", {})
            geo = d.get("city", {}).get("geo")
            if isinstance(geo, list) and len(geo) == 2:
                dist = haversine_km(lat, lon, float(geo[0]), float(geo[1]))
                if dist > 120.0:
                    return None
                d["_distance_km"] = dist
            return d
    except Exception:
        return None


def _safe_float(val: Any) -> Optional[float]:
    if val is None:
        return None
    try:
        f = float(val)
        return None if math.isnan(f) or f < 0 else round(f, 2)
    except (TypeError, ValueError):
        return None


def build_pollutant_readings(
    open_meteo_air: Dict[str, Any],
    cpcb_station: Optional[Dict[str, Any]],
    fetched_at: str,
) -> List[PollutantReading]:
    """Combine verified Open-Meteo physical concentrations & CPCB sub-indices without fabrication."""
    current = open_meteo_air.get("current", {})
    hourly = open_meteo_air.get("hourly", {})
    times: List[str] = hourly.get("time", [])
    current_time = current.get("time")

    # Find current index in hourly array to compute real 3h delta
    cur_idx = None
    if current_time and current_time in times:
        cur_idx = times.index(current_time)
    else:
        # Closest timestamp <= now
        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H")
        for i, t in enumerate(times):
            if t[:13] <= now_iso:
                cur_idx = i

    def _trend(series_key: str, cur_val: Optional[float]) -> Tuple[str, Optional[float]]:
        arr = hourly.get(series_key) or []
        if cur_val is None or cur_idx is None or cur_idx < 3 or cur_idx >= len(arr):
            return "unknown", None
        prev = _safe_float(arr[cur_idx - 3])
        if prev is None or prev == 0:
            return "stable", 0.0
        pct = round(((cur_val - prev) / prev) * 100.0, 1)
        if pct > 4.0:
            return "up", pct
        if pct < -4.0:
            return "down", pct
        return "stable", pct

    specs = [
        ("PM2.5", "Fine Particulate Matter (PM2.5)", "pm2_5", "PM2.5", "µg/m³", "15 µg/m³", 15.0),
        ("PM10", "Coarse Particulate Matter (PM10)", "pm10", "PM10", "µg/m³", "45 µg/m³", 45.0),
        ("CO", "Carbon Monoxide (CO)", "carbon_monoxide", "CO", "µg/m³", "4000 µg/m³", 4000.0),
        ("NO2", "Nitrogen Dioxide (NO₂)", "nitrogen_dioxide", "NO2", "µg/m³", "25 µg/m³", 25.0),
        ("SO2", "Sulfur Dioxide (SO₂)", "sulphur_dioxide", "SO2", "µg/m³", "40 µg/m³", 40.0),
        ("O3", "Ground-Level Ozone (O₃)", "ozone", "OZONE", "µg/m³", "100 µg/m³ (8h)", 100.0),
        ("NH3", "Ammonia (NH₃)", "ammonia", "NH3", "µg/m³", None, None),
    ]

    cpcb_subs = (cpcb_station or {}).get("sub_indices", {})
    cpcb_obs_at = (cpcb_station or {}).get("observed_at")
    om_obs_at = current.get("time")

    readings: List[PollutantReading] = []
    for code, name, om_key, cpcb_key, unit, who_str, who_limit in specs:
        om_val = _safe_float(current.get(om_key))
        sub_idx = cpcb_subs.get(cpcb_key)
        trend, delta = _trend(om_key, om_val)

        if om_val is not None:
            readings.append(
                PollutantReading(
                    code=code,  # type: ignore[arg-type]
                    name=name,
                    available=True,
                    value=om_val,
                    unit=unit,
                    sub_index=sub_idx,
                    observation_type="official_monitoring_station" if sub_idx is not None else "modelled_estimate",
                    source_name=(
                        f"CPCB ({cpcb_station['name']}) + Open-Meteo CAMS"
                        if sub_idx is not None and cpcb_station
                        else "Open-Meteo CAMS Atmospheric Model"
                    ),
                    observed_at=cpcb_obs_at or om_obs_at or fetched_at,
                    who_guideline_24h=who_str,
                    exceeds_who=(om_val > who_limit) if who_limit is not None else None,
                    trend=trend,  # type: ignore[arg-type]
                    change_percent=delta,
                    status_note=(
                        f"CPCB NAQI sub-index: {sub_idx}"
                        if sub_idx is not None
                        else "Modelled hourly concentration (Open-Meteo CAMS)"
                    ),
                )
            )
        elif sub_idx is not None and cpcb_station:
            readings.append(
                PollutantReading(
                    code=code,  # type: ignore[arg-type]
                    name=name,
                    available=True,
                    value=float(sub_idx),
                    unit="NAQI sub-index",
                    sub_index=sub_idx,
                    observation_type="official_monitoring_station",
                    source_name=f"CPCB Official Station ({cpcb_station['name']})",
                    observed_at=cpcb_obs_at,
                    who_guideline_24h=who_str,
                    exceeds_who=None,
                    trend="unknown",
                    change_percent=None,
                    status_note="Official CPCB station reports NAQI sub-index; raw concentration not in RSS feed.",
                )
            )
        else:
            readings.append(
                PollutantReading(
                    code=code,  # type: ignore[arg-type]
                    name=name,
                    available=False,
                    value=None,
                    unit=unit,
                    sub_index=None,
                    observation_type="unavailable",
                    source_name="Not reported by active feeds",
                    observed_at=None,
                    who_guideline_24h=who_str,
                    exceeds_who=None,
                    trend="unknown",
                    change_percent=None,
                    status_note=f"{code} is unavailable for this location from connected telemetry sources.",
                )
            )

    # Pb (Lead) — strictly honest availability check (never fabricated)
    readings.append(
        PollutantReading(
            code="Pb",
            name="Lead (Pb)",
            available=False,
            value=None,
            unit="µg/m³",
            sub_index=None,
            observation_type="unavailable",
            source_name="Periodic Lab Filter Sampling Required",
            observed_at=None,
            who_guideline_24h="0.5 µg/m³ (Annual)",
            exceeds_who=None,
            trend="unknown",
            change_percent=None,
            status_note="Pb is not continuously telemetered by CPCB CAAQMS RSS or Open-Meteo; periodic gravimetric lab analysis applies.",
        )
    )
    return readings


def build_historical_series(open_meteo_air: Dict[str, Any], hours: int = 48) -> List[HistoricalPoint]:
    """Extract past N hourly points prior to current time from Open-Meteo response."""
    hourly = open_meteo_air.get("hourly", {})
    times: List[str] = hourly.get("time", [])
    current_time = (open_meteo_air.get("current", {}) or {}).get("time")

    cutoff_idx = len(times)
    if current_time and current_time in times:
        cutoff_idx = times.index(current_time) + 1
    else:
        now_prefix = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H")
        past_indices = [i for i, t in enumerate(times) if t[:13] <= now_prefix]
        if past_indices:
            cutoff_idx = past_indices[-1] + 1

    start_idx = max(0, cutoff_idx - hours)
    us_aqi = hourly.get("us_aqi", [])
    pm25 = hourly.get("pm2_5", [])
    pm10 = hourly.get("pm10", [])
    o3 = hourly.get("ozone", [])
    no2 = hourly.get("nitrogen_dioxide", [])
    so2 = hourly.get("sulphur_dioxide", [])
    co = hourly.get("carbon_monoxide", [])
    nh3 = hourly.get("ammonia", [])

    points: List[HistoricalPoint] = []
    for i in range(start_idx, min(cutoff_idx, len(times))):
        raw_aqi = us_aqi[i] if i < len(us_aqi) else None
        points.append(
            HistoricalPoint(
                timestamp=times[i],
                aqi=int(raw_aqi) if raw_aqi is not None else None,
                pm25=_safe_float(pm25[i]) if i < len(pm25) else None,
                pm10=_safe_float(pm10[i]) if i < len(pm10) else None,
                o3=_safe_float(o3[i]) if i < len(o3) else None,
                no2=_safe_float(no2[i]) if i < len(no2) else None,
                so2=_safe_float(so2[i]) if i < len(so2) else None,
                co=_safe_float(co[i]) if i < len(co) else None,
                nh3=_safe_float(nh3[i]) if i < len(nh3) else None,
            )
        )
    return points
