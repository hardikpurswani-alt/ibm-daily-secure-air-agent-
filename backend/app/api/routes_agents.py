"""Specialist Agent & Multi-Agent Briefing endpoints."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..agents.aqi_data_agent import aqi_data_agent
from ..agents.community_agent import community_action_agent
from ..agents.coordinator import _load_profile, coordinator
from ..agents.forecasting_agent import forecasting_agent
from ..agents.health_agent import health_advisory_agent
from ..core.database import get_db
from ..core.security import resolve_owner_key
from ..models.db_models import CommunityPledge, PollutionReport
from ..schemas.airguard import (
    CommunityInsightResponse,
    ForecastResponse,
    HealthAdvisoryResponse,
    HealthProfileInput,
    PledgeRequest,
    PollutionReportRequest,
    UnifiedBriefingResponse,
)

router = APIRouter(prefix="/api/v1/agents", tags=["Multi-Agent System"])


@router.get("/briefing", response_model=UnifiedBriefingResponse)
async def get_unified_briefing(
    city: str = Query(default="Delhi", min_length=1, max_length=120),
    lat: Optional[float] = Query(default=None, ge=-90, le=90),
    lon: Optional[float] = Query(default=None, ge=-180, le=180),
    db: Session = Depends(get_db),
    owner_key: str = Depends(resolve_owner_key),
):
    """Run all four specialist agents in coordinated workflow and return unified dashboard intelligence."""
    try:
        return await coordinator.run_unified_briefing(city=city, db=db, owner_key=owner_key, lat=lat, lon=lon)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"Agent briefing unavailable due to upstream error: {exc}") from exc


@router.post("/health-advisory", response_model=HealthAdvisoryResponse)
async def run_health_advisory(
    profile: HealthProfileInput,
    city: str = Query(default="Delhi", min_length=1, max_length=120),
    lat: Optional[float] = Query(default=None),
    lon: Optional[float] = Query(default=None),
):
    """Invoke Health Advisory Agent with explicit age, activity, and optional considerations."""
    live = await aqi_data_agent.get_live_aqi(city=city, lat=lat, lon=lon)
    return await health_advisory_agent.generate(live=live, profile=profile)


@router.get("/health-advisory", response_model=HealthAdvisoryResponse)
async def get_health_advisory(
    city: str = Query(default="Delhi", min_length=1, max_length=120),
    db: Session = Depends(get_db),
    owner_key: str = Depends(resolve_owner_key),
):
    """Invoke Health Advisory Agent using saved user/guest profile."""
    live = await aqi_data_agent.get_live_aqi(city=city)
    profile = _load_profile(db, owner_key)
    return await health_advisory_agent.generate(live=live, profile=profile)


@router.get("/forecast", response_model=ForecastResponse)
async def get_forecast(
    city: str = Query(default="Delhi", min_length=1, max_length=120),
    horizon_hours: int = Query(default=48, ge=12, le=72),
):
    """Invoke Forecasting Agent for probabilistic 48-72h trajectory & early warnings."""
    live = await aqi_data_agent.get_live_aqi(city=city)
    hist = await aqi_data_agent.get_historical_analytics(city=city, hours=48)
    return await forecasting_agent.generate(live=live, historical=hist.points, horizon_hours=horizon_hours)


@router.get("/community", response_model=CommunityInsightResponse)
async def get_community_insights(
    city: str = Query(default="Delhi", min_length=1, max_length=120),
    db: Session = Depends(get_db),
    owner_key: str = Depends(resolve_owner_key),
):
    """Invoke Community Action Agent with database-backed pledges & RAG policy summaries."""
    live = await aqi_data_agent.get_live_aqi(city=city)
    return await community_action_agent.generate(live=live, db=db, owner_key=owner_key)


@router.post("/community/pledges")
def toggle_community_pledge(
    payload: PledgeRequest,
    db: Session = Depends(get_db),
    owner_key: str = Depends(resolve_owner_key),
):
    """Toggle a persistent community action pledge for the active user/session."""
    existing = (
        db.query(CommunityPledge)
        .filter(
            CommunityPledge.action_id == payload.action_id,
            CommunityPledge.owner_key == owner_key,
        )
        .first()
    )
    if existing:
        db.delete(existing)
        db.commit()
        pledged = False
    else:
        db.add(
            CommunityPledge(
                action_id=payload.action_id,
                owner_key=owner_key,
                city=payload.city,
                note=payload.note,
            )
        )
        db.commit()
        pledged = True

    total = db.query(CommunityPledge).filter(CommunityPledge.action_id == payload.action_id).count()
    return {"action_id": payload.action_id, "user_pledged": pledged, "pledge_count": total}


@router.post("/community/reports", status_code=201)
def submit_pollution_report(
    payload: PollutionReportRequest,
    db: Session = Depends(get_db),
    owner_key: str = Depends(resolve_owner_key),
):
    """Persist a citizen pollution observation report in the database."""
    rec = PollutionReport(
        owner_key=owner_key,
        city=payload.city.strip(),
        category=payload.category,
        description=payload.description.strip(),
        latitude=payload.latitude,
        longitude=payload.longitude,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return {
        "id": rec.id,
        "city": rec.city,
        "category": rec.category,
        "description": rec.description,
        "created_at": rec.created_at.isoformat() if rec.created_at else "",
    }
