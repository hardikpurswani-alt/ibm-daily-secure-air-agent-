"""Real-time AQI, historical analytics, and geocoding location search endpoints."""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from ..agents.aqi_data_agent import aqi_data_agent
from ..schemas.airguard import HistoricalAnalyticsResponse, LiveAQIResponse, LocationSuggestion
from ..services import aqi_sources

router = APIRouter(prefix="/api/v1/aqi", tags=["AQI Telemetry"])


@router.get("/live", response_model=LiveAQIResponse)
async def get_live_aqi(
    city: str = Query(default="Delhi", min_length=1, max_length=120),
    lat: Optional[float] = Query(default=None, ge=-90, le=90),
    lon: Optional[float] = Query(default=None, ge=-180, le=180),
):
    """Retrieve validated real-time AQI, pollutants, meteorology, and hotspots."""
    try:
        return await aqi_data_agent.get_live_aqi(city=city, lat=lat, lon=lon)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=503,
            detail=f"Live air quality data sources are temporarily unavailable ({exc}). Real readings were not fabricated.",
        ) from exc


@router.get("/historical", response_model=HistoricalAnalyticsResponse)
async def get_historical_aqi(
    city: str = Query(default="Delhi", min_length=1, max_length=120),
    hours: int = Query(default=48, ge=6, le=72),
    lat: Optional[float] = Query(default=None, ge=-90, le=90),
    lon: Optional[float] = Query(default=None, ge=-180, le=180),
):
    """Retrieve hourly historical pollutant & AQI curves with descriptive statistics."""
    try:
        return await aqi_data_agent.get_historical_analytics(city=city, hours=hours, lat=lat, lon=lon)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"Historical AQI feed unavailable: {exc}") from exc


@router.get("/search-locations", response_model=List[LocationSuggestion])
async def search_locations_route(q: str = Query(default="", max_length=100), count: int = Query(default=6, ge=1, le=15)):
    """Autocomplete city locations via Open-Meteo geocoding."""
    return await aqi_sources.search_locations(query=q, count=count)
