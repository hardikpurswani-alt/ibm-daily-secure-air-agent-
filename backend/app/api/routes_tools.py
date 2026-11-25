"""OpenAPI 3.0 tool endpoints specifically exposed for IBM watsonx Orchestrate specialist agents."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..agents.aqi_data_agent import aqi_data_agent
from ..agents.community_agent import community_action_agent
from ..agents.forecasting_agent import forecasting_agent
from ..agents.health_agent import health_advisory_agent
from ..core.database import get_db
from ..schemas.airguard import (
    CommunityInsightResponse,
    ForecastResponse,
    HealthAdvisoryResponse,
    HealthProfileInput,
    LiveAQIResponse,
)
from ..services.rag_service import rag_engine

router = APIRouter(prefix="/api/v1/tools", tags=["watsonx Orchestrate Tools"])


@router.get("/aqi-data", operation_id="get_live_aqi_data", response_model=LiveAQIResponse)
async def tool_get_live_aqi_data(
    city: str = Query(..., description="City or region name to fetch validated real-time air quality data for.")
):
    """Retrieve validated real-time AQI, pollutants (PM2.5, PM10, CO, NO2, SO2, O3, NH3, Pb), timestamps, and hotspots."""
    return await aqi_data_agent.get_live_aqi(city=city)


@router.get("/health-advisory", operation_id="generate_health_advisory", response_model=HealthAdvisoryResponse)
async def tool_generate_health_advisory(
    city: str = Query(..., description="Target city name."),
    age_group: str = Query(default="adult", description="One of: child, adult, older_adult."),
    outdoor_activity: str = Query(default="moderate", description="One of: low, moderate, high, outdoor_worker."),
    health_considerations: Optional[str] = Query(
        default="", description="Comma-separated optional sensitivities e.g. asthma,heart."
    ),
):
    """Generate personalized daily preventive air quality precautions, mask guidance, and indoor air recommendations."""
    live = await aqi_data_agent.get_live_aqi(city=city)
    items = [c.strip() for c in (health_considerations or "").split(",") if c.strip()]
    safe_age = age_group if age_group in ("child", "adult", "older_adult") else "adult"
    safe_act = outdoor_activity if outdoor_activity in ("low", "moderate", "high", "outdoor_worker") else "moderate"
    profile = HealthProfileInput(
        age_group=safe_age,  # type: ignore[arg-type]
        outdoor_activity=safe_act,  # type: ignore[arg-type]
        health_considerations=items,
    )
    return await health_advisory_agent.generate(live=live, profile=profile)


@router.get("/forecast", operation_id="get_aqi_forecast", response_model=ForecastResponse)
async def tool_get_aqi_forecast(
    city: str = Query(..., description="Target city name."),
    horizon_hours: int = Query(default=48, ge=12, le=72, description="Forecast horizon in hours (12-72)."),
):
    """Analyze historical trends and upcoming air quality forecasts with uncertainty intervals and early warnings."""
    live = await aqi_data_agent.get_live_aqi(city=city)
    hist = await aqi_data_agent.get_historical_analytics(city=city, hours=48)
    return await forecasting_agent.generate(live=live, historical=hist.points, horizon_hours=horizon_hours)


@router.get("/community-action", operation_id="get_community_actions", response_model=CommunityInsightResponse)
async def tool_get_community_actions(
    city: str = Query(..., description="Target city name."),
    db: Session = Depends(get_db),
):
    """Generate community pollution-reduction campaigns, emission driver insights, and summarized clean-air policies."""
    live = await aqi_data_agent.get_live_aqi(city=city)
    return await community_action_agent.generate(live=live, db=db, owner_key="orchestrate:tool")


@router.get("/rag-lookup", operation_id="search_environmental_guidelines")
def tool_rag_lookup(
    query: str = Query(..., description="Environmental policy, WHO/EPA/CPCB guideline, or mask/HEPA health query."),
    top_k: int = Query(default=4, ge=1, le=8),
):
    """Search verified WHO, US EPA, India CPCB/GRAP, CDC, and UNEP air quality documents with citations."""
    return {"query": query, "citations": rag_engine.retrieve(query=query, top_k=top_k)}
