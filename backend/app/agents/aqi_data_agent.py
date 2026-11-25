"""Specialist Agent A: AQI Data Agent — Retrieval, Validation, Source Attribution & Hotspots."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from ..core.config import get_settings
from ..schemas.airguard import (
    HistoricalAnalyticsResponse,
    HotspotStation,
    LiveAQIResponse,
    MeteorologyContext,
    SourceAttribution,
    ValidationReport,
)
from ..services import aqi_sources

logger = logging.getLogger("airguard.agent.aqi_data")


class AQIDataAgent:
    """Retrieves real-time air quality observations, validates telemetry, and detects hotspots."""

    async def get_live_aqi(
        self,
        city: str,
        lat: Optional[float] = None,
        lon: Optional[float] = None,
    ) -> LiveAQIResponse:
        fetched_at = datetime.now(timezone.utc).isoformat()
        location = await aqi_sources.resolve_location(city=city, lat=lat, lon=lon)

        # Fetch Open-Meteo (modelled + meteorologic context) and CPCB stations in parallel
        cpcb_all = await aqi_sources.fetch_cpcb_stations()
        om_bundle = await aqi_sources.fetch_open_meteo_bundle(location.latitude, location.longitude)
        waqi_data = await aqi_sources.fetch_optional_waqi(location.latitude, location.longitude)

        air = om_bundle["air"]
        weather = om_bundle.get("weather", {})
        air_cur = air.get("current", {})
        w_cur = weather.get("current", {})

        # Find nearest CPCB station within 80 km (relevant for India)
        nearby_cpcb: List[Tuple[float, Dict[str, Any]]] = []
        for st in cpcb_all:
            dist = aqi_sources.haversine_km(location.latitude, location.longitude, st["latitude"], st["longitude"])
            if dist <= 80.0:
                nearby_cpcb.append((dist, st))
        nearby_cpcb.sort(key=lambda item: item[0])

        nearest_cpcb = nearby_cpcb[0][1] if nearby_cpcb else None
        nearest_cpcb_dist = nearby_cpcb[0][0] if nearby_cpcb else None

        # Check NSW EPA stations if near Australia/NSW
        nsw_sites = []
        if -38.0 <= location.latitude <= -28.0 and 140.0 <= location.longitude <= 154.0:
            raw_nsw = await aqi_sources.fetch_nsw_sites()
            for site in raw_nsw:
                slat = site.get("Latitude")
                slon = site.get("Longitude")
                if slat is not None and slon is not None:
                    d = aqi_sources.haversine_km(location.latitude, location.longitude, float(slat), float(slon))
                    if d <= 80.0:
                        nsw_sites.append((d, site))
            nsw_sites.sort(key=lambda item: item[0])

        pollutants = aqi_sources.build_pollutant_readings(
            open_meteo_air=air,
            cpcb_station=nearest_cpcb,
            fetched_at=fetched_at,
        )

        us_aqi = int(air_cur["us_aqi"]) if air_cur.get("us_aqi") is not None else None
        eu_aqi = int(air_cur["european_aqi"]) if air_cur.get("european_aqi") is not None else None
        india_naqi = nearest_cpcb.get("aqi") if nearest_cpcb else None

        # Primary AQI selection: prefer official CPCB station when available & valid, else Open-Meteo US AQI
        supplementary: List[SourceAttribution] = []
        om_obs_time = air_cur.get("time")
        om_freshness, om_mins = aqi_sources.compute_freshness(om_obs_time)
        om_source = SourceAttribution(
            source_name="Open-Meteo CAMS Atmospheric Model",
            source_url="https://open-meteo.com/en/docs/air-quality-api",
            observation_type="modelled_estimate",
            station_id=f"cams-{location.latitude:.2f},{location.longitude:.2f}",
            station_name=f"{location.city} Model Grid",
            distance_km=0.0,
            observed_at=om_obs_time,
            fetched_at=fetched_at,
            freshness=om_freshness,
            freshness_minutes=om_mins,
        )

        if nearest_cpcb and india_naqi is not None:
            cpcb_fresh, cpcb_mins = aqi_sources.compute_freshness(nearest_cpcb.get("observed_at"))
            primary_source = SourceAttribution(
                source_name="Central Pollution Control Board (CPCB India)",
                source_url="https://airquality.cpcb.gov.in/",
                observation_type="official_monitoring_station",
                station_id=nearest_cpcb["station_id"],
                station_name=nearest_cpcb["name"],
                distance_km=nearest_cpcb_dist,
                observed_at=nearest_cpcb.get("observed_at"),
                fetched_at=fetched_at,
                freshness=cpcb_fresh,
                freshness_minutes=cpcb_mins,
            )
            supplementary.append(om_source)
            primary_aqi = india_naqi
            aqi_scale = "India NAQI (Official Station)"
            dominant = nearest_cpcb.get("predominant_parameter") or "PM2.5"
        elif waqi_data and isinstance(waqi_data.get("aqi"), int):
            primary_aqi = int(waqi_data["aqi"])
            aqi_scale = "US AQI (WAQI Station)"
            dominant = (waqi_data.get("dominentpol") or "PM2.5").upper()
            w_time = (waqi_data.get("time") or {}).get("iso")
            w_fresh, w_mins = aqi_sources.compute_freshness(w_time)
            primary_source = SourceAttribution(
                source_name="World Air Quality Index (WAQI)",
                source_url="https://aqicn.org/",
                observation_type="official_monitoring_station",
                station_id=str(waqi_data.get("idx", "waqi")),
                station_name=(waqi_data.get("city") or {}).get("name", location.city),
                distance_km=waqi_data.get("_distance_km"),
                observed_at=w_time,
                fetched_at=fetched_at,
                freshness=w_fresh,
                freshness_minutes=w_mins,
            )
            supplementary.append(om_source)
        else:
            primary_aqi = us_aqi
            aqi_scale = "US AQI (Modelled CAMS Estimate)"
            # Determine dominant pollutant by WHO ratio
            dominant = "PM2.5"
            pm25_r = next((p for p in pollutants if p.code == "PM2.5" and p.value is not None), None)
            pm10_r = next((p for p in pollutants if p.code == "PM10" and p.value is not None), None)
            o3_r = next((p for p in pollutants if p.code == "O3" and p.value is not None), None)
            ratios = []
            if pm25_r and pm25_r.value is not None:
                ratios.append((pm25_r.value / 15.0, "PM2.5"))
            if pm10_r and pm10_r.value is not None:
                ratios.append((pm10_r.value / 45.0, "PM10"))
            if o3_r and o3_r.value is not None:
                ratios.append((o3_r.value / 100.0, "O3"))
            if ratios:
                dominant = max(ratios, key=lambda x: x[0])[1]
            primary_source = om_source

        if nsw_sites:
            d, nsw_st = nsw_sites[0]
            supplementary.append(
                SourceAttribution(
                    source_name="NSW Department of Climate Change & Environment (Australia)",
                    source_url="https://www.airquality.nsw.gov.au/",
                    observation_type="official_monitoring_station",
                    station_id=str(nsw_st.get("Site_Id", "")),
                    station_name=nsw_st.get("SiteName", ""),
                    distance_km=d,
                    observed_at=None,
                    fetched_at=fetched_at,
                    freshness="aging",
                )
            )

        # Validation checks
        checks_passed: List[str] = []
        warnings: List[str] = []
        if primary_aqi is not None and 0 <= primary_aqi <= 500:
            checks_passed.append("AQI within valid EPA/NAQI bounds (0–500)")
        else:
            warnings.append("Primary AQI missing or outside expected 0–500 scale")

        non_neg = all((p.value is None or p.value >= 0) for p in pollutants)
        if non_neg:
            checks_passed.append("All reported pollutant concentrations non-negative")
        else:
            warnings.append("Detected invalid negative pollutant measurement")

        if primary_source.freshness in ("fresh", "aging"):
            checks_passed.append(f"Telemetry timestamp verified ({primary_source.freshness})")
        else:
            warnings.append("Primary observation timestamp is stale or unavailable")

        unavail_codes = [p.code for p in pollutants if not p.available]
        if unavail_codes:
            warnings.append(f"Unmonitored / unavailable pollutants not fabricated: {', '.join(unavail_codes)}")

        # Hotspots across nearby stations
        hotspots: List[HotspotStation] = []
        median_aqi = primary_aqi or 100
        for dist, st in nearby_cpcb[:25]:
            st_aqi = st.get("aqi")
            hotspots.append(
                HotspotStation(
                    station_id=st["station_id"],
                    name=st["name"],
                    city=st["city"],
                    latitude=st["latitude"],
                    longitude=st["longitude"],
                    aqi=st_aqi,
                    aqi_scale="India NAQI",
                    level=aqi_sources.aqi_to_level(st_aqi),
                    dominant_pollutant=st.get("predominant_parameter"),
                    observation_type="official_monitoring_station",
                    source_name="CPCB India",
                    observed_at=st.get("observed_at"),
                    distance_km=dist,
                    is_hotspot=bool(st_aqi is not None and (st_aqi > 150 or st_aqi >= median_aqi * 1.15)),
                )
            )

        if not hotspots and nsw_sites:
            for dist, site in nsw_sites[:12]:
                hotspots.append(
                    HotspotStation(
                        station_id=str(site.get("Site_Id")),
                        name=site.get("SiteName", "NSW Site"),
                        city=site.get("Region", location.city),
                        latitude=float(site["Latitude"]),
                        longitude=float(site["Longitude"]),
                        aqi=us_aqi,
                        aqi_scale="Regional Reference",
                        level=aqi_sources.aqi_to_level(us_aqi),
                        dominant_pollutant=dominant,
                        observation_type="official_monitoring_station",
                        source_name="NSW EPA Registry",
                        observed_at=om_obs_time,
                        distance_km=dist,
                        is_hotspot=False,
                    )
                )

        if not hotspots:
            hotspots.append(
                HotspotStation(
                    station_id=primary_source.station_id or "grid-center",
                    name=primary_source.station_name or location.city,
                    city=location.city,
                    latitude=location.latitude,
                    longitude=location.longitude,
                    aqi=primary_aqi,
                    aqi_scale=aqi_scale,
                    level=aqi_sources.aqi_to_level(primary_aqi),
                    dominant_pollutant=dominant,
                    observation_type=primary_source.observation_type,
                    source_name=primary_source.source_name,
                    observed_at=primary_source.observed_at,
                    distance_km=0.0,
                    is_hotspot=bool(primary_aqi is not None and primary_aqi > 150),
                )
            )

        meteorology = MeteorologyContext(
            temperature_c=aqi_sources._safe_float(w_cur.get("temperature_2m")),
            relative_humidity_pct=int(w_cur["relative_humidity_2m"]) if w_cur.get("relative_humidity_2m") is not None else None,
            wind_speed_kmh=aqi_sources._safe_float(w_cur.get("wind_speed_10m")),
            wind_direction_deg=int(w_cur["wind_direction_10m"]) if w_cur.get("wind_direction_10m") is not None else None,
            surface_pressure_hpa=aqi_sources._safe_float(w_cur.get("surface_pressure")),
            uv_index=aqi_sources._safe_float(air_cur.get("uv_index")),
            dust_ugm3=aqi_sources._safe_float(air_cur.get("dust")),
            observed_at=w_cur.get("time") or om_obs_at,
        )

        level = aqi_sources.aqi_to_level(primary_aqi)
        hotspot_count = sum(1 for h in hotspots if h.is_hotspot)
        summary = (
            f"{location.city} currently records {aqi_scale} {primary_aqi} ({level}), "
            f"driven primarily by {dominant}. Source: {primary_source.source_name}. "
            f"Detected {hotspot_count} elevated local hotspot(s) across {len(hotspots)} monitored point(s)."
        )

        return LiveAQIResponse(
            location=location,
            aqi=primary_aqi,
            aqi_scale=aqi_scale,
            level=level,
            us_aqi=us_aqi,
            european_aqi=eu_aqi,
            india_naqi=india_naqi,
            dominant_pollutant=dominant,
            pollutants=pollutants,
            meteorology=meteorology,
            primary_source=primary_source,
            supplementary_sources=supplementary,
            validation=ValidationReport(valid=not bool(warnings and primary_aqi is None), checks_passed=checks_passed, warnings=warnings),
            hotspots=hotspots,
            summary=summary,
        )

    async def get_historical_analytics(
        self,
        city: str,
        hours: int = 48,
        lat: Optional[float] = None,
        lon: Optional[float] = None,
    ) -> HistoricalAnalyticsResponse:
        location = await aqi_sources.resolve_location(city=city, lat=lat, lon=lon)
        bundle = await aqi_sources.fetch_open_meteo_bundle(location.latitude, location.longitude)
        points = aqi_sources.build_historical_series(bundle["air"], hours=hours)

        aqi_vals = [p.aqi for p in points if p.aqi is not None]
        pm25_vals = [p.pm25 for p in points if p.pm25 is not None]
        exceedance_hours = sum(1 for v in aqi_vals if v > 100)
        stats = {
            "min_aqi": min(aqi_vals) if aqi_vals else None,
            "max_aqi": max(aqi_vals) if aqi_vals else None,
            "avg_aqi": round(sum(aqi_vals) / len(aqi_vals), 1) if aqi_vals else None,
            "avg_pm25": round(sum(pm25_vals) / len(pm25_vals), 1) if pm25_vals else None,
            "exceedance_hours_over_100": exceedance_hours,
            "peak_timestamp": max(points, key=lambda x: x.aqi or -1).timestamp if points else None,
        }

        return HistoricalAnalyticsResponse(
            location=location,
            observation_type="modelled_estimate",
            source_name="Open-Meteo CAMS Historical Hourly Series",
            fetched_at=datetime.now(timezone.utc).isoformat(),
            hours=len(points),
            points=points,
            stats=stats,
        )


aqi_data_agent = AQIDataAgent()
