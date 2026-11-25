"""Specialist Agent D: Community Action Agent — Campaigns, Pledges & Policy Summaries."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models.db_models import CommunityPledge, PollutionReport
from ..schemas.airguard import (
    CommunityActionItem,
    CommunityInsightResponse,
    LiveAQIResponse,
    PolicySummaryItem,
    ReasoningMode,
)
from ..services.granite_service import granite_service
from ..services.rag_service import rag_engine

BASE_ACTIONS = [
    {
        "id": "carpool-transit",
        "title": "Organize Neighborhood Carpool & Rail Commute",
        "description": "Replace solo petrol/diesel trips with 3+ person carpools, metro rail, or electric buses during peak commute hours.",
        "category": "transport",
        "impact": "high",
        "difficulty": "easy",
        "tags": ["carpooling", "public-transit", "no2-reduction"],
    },
    {
        "id": "zero-waste-burning",
        "title": "Zero Open Leaf & Waste Burning Pledge",
        "description": "Compost garden clippings and route dry waste through municipal collection instead of open-air burning.",
        "category": "waste",
        "impact": "high",
        "difficulty": "easy",
        "tags": ["waste-reduction", "pm25-prevention", "composting"],
    },
    {
        "id": "native-tree-belt",
        "title": "Native Urban Canopy & Dust-Buffer Plantation",
        "description": "Join municipal weekend drives planting native, drought-tolerant broadleaf trees along dusty arterial corridors.",
        "category": "plantation",
        "impact": "high",
        "difficulty": "moderate",
        "tags": ["tree-plantation", "heat-island", "dust-capture"],
    },
    {
        "id": "clean-air-shelter",
        "title": "Support Community Clean-Air Rooms & School Advisories",
        "description": "Help schools and senior centers adopt HEPA air purifiers and outdoor-recess AQI thresholds.",
        "category": "energy_indoor",
        "impact": "high",
        "difficulty": "moderate",
        "tags": ["schools", "clean-air", "equity"],
    },
    {
        "id": "civic-311-reporting",
        "title": "Document & Report Uncovered Dust or Smoke",
        "description": "Log uncovered construction debris, idling commercial fleets, or illegal smoke via official municipal/CPCB portals.",
        "category": "civic_advocacy",
        "impact": "medium",
        "difficulty": "easy",
        "tags": ["civic-action", "grap-enforcement", "dust-control"],
    },
]


class CommunityActionAgent:
    """Drives collective community awareness, persisted pledges, and government policy summaries."""

    async def generate(
        self,
        live: LiveAQIResponse,
        db: Session,
        owner_key: str,
    ) -> CommunityInsightResponse:
        aqi = live.aqi or 50
        city = live.location.city
        country = (live.location.country or "").lower()

        # Real persisted pledge counts from DB
        pledge_counts = dict(
            db.query(CommunityPledge.action_id, func.count(CommunityPledge.id))
            .group_by(CommunityPledge.action_id)
            .all()
        )
        user_pledged_ids = {
            row[0]
            for row in db.query(CommunityPledge.action_id)
            .filter(CommunityPledge.owner_key == owner_key)
            .all()
        }

        actions = [
            CommunityActionItem(
                id=a["id"],
                title=a["title"],
                description=a["description"],
                category=a["category"],  # type: ignore[arg-type]
                impact=a["impact"],  # type: ignore[arg-type]
                difficulty=a["difficulty"],  # type: ignore[arg-type]
                pledge_count=int(pledge_counts.get(a["id"], 0)),
                user_pledged=a["id"] in user_pledged_ids,
                tags=a["tags"],
            )
            for a in BASE_ACTIONS
        ]

        # Real persisted citizen pollution reports for this city
        recent_reports_rows = (
            db.query(PollutionReport)
            .filter(func.lower(PollutionReport.city) == city.lower())
            .order_by(PollutionReport.created_at.desc())
            .limit(8)
            .all()
        )
        total_reports = (
            db.query(func.count(PollutionReport.id))
            .filter(func.lower(PollutionReport.city) == city.lower())
            .scalar()
            or 0
        )
        recent_reports = [
            {
                "id": r.id,
                "category": r.category,
                "description": r.description,
                "created_at": r.created_at.isoformat() if r.created_at else "",
            }
            for r in recent_reports_rows
        ]

        source_hypothesis = self._infer_dominant_source(live)
        rag_query = f"community clean air policy carpooling public transport GRAP EPA WHO {country} AQI {aqi}"
        citations = rag_engine.retrieve(rag_query, top_k=4)
        policies = self._build_policy_summaries(aqi, country)

        system_prompt = (
            "You are the AirGuard Community Action Specialist Agent. Craft a concise community action brief "
            "combining local emission drivers, public transit/carpooling/waste/tree-plantation steps, and relevant "
            "policy guidance from retrieved sources."
        )
        user_prompt = (
            f"City: {city} ({live.location.country}), AQI: {aqi} ({live.level}), Dominant: {live.dominant_pollutant}\n"
            f"Probable local driver: {source_hypothesis}\n"
            f"Citizen reports logged: {total_reports}\n"
            f"Sources: {[c.title + ' - ' + c.section for c in citations]}\n"
            "Return JSON with keys: campaign_headline (string under 16 words) and granite_analysis (string under 100 words)."
        )
        granite_json, _ = granite_service.structured_json(system_prompt=system_prompt, user_prompt=user_prompt)

        if granite_json:
            reasoning_mode: ReasoningMode = "ibm_watsonx_granite"
            headline = str(granite_json.get("campaign_headline") or self._default_headline(city, aqi))
            analysis = str(granite_json.get("granite_analysis") or "")
        else:
            reasoning_mode = "deterministic_evidence_synthesis"
            headline = self._default_headline(city, aqi)
            analysis = (
                f"In {city}, current {live.dominant_pollutant or 'particulate'} readings point toward {source_hypothesis.lower()}. "
                f"Coordinated adoption of public transit, carpooling, zero open waste burning, and dust-control reporting "
                f"directly targets primary precursor emissions alongside official policy advisories."
            )

        return CommunityInsightResponse(
            location=city,
            aqi=live.aqi,
            dominant_source_hypothesis=source_hypothesis,
            local_report_count=int(total_reports),
            campaign_headline=headline,
            actions=actions,
            policy_summaries=policies,
            recent_reports=recent_reports,
            reasoning_mode=reasoning_mode,
            granite_analysis=analysis,
            citations=citations,
            generated_at=datetime.now(timezone.utc).isoformat(),
        )

    @staticmethod
    def _infer_dominant_source(live: LiveAQIResponse) -> str:
        dom = (live.dominant_pollutant or "").upper()
        if "O3" in dom or "OZONE" in dom:
            return "Photochemical ozone formation from sunlight reacting with vehicle/industrial NOx and VOCs"
        if "NO2" in dom or "CO" in dom:
            return "Dense vehicular exhaust and urban combustion corridors"
        if "SO2" in dom:
            return "Industrial fuel combustion, power generation, or heavy diesel activity"
        if "PM10" in dom:
            return "Road dust resuspension, construction debris, and coarse particulate transport"
        return "Mixed urban combustion, traffic exhaust, and secondary fine particulate accumulation (PM2.5)"

    @staticmethod
    def _default_headline(city: str, aqi: int) -> str:
        if aqi > 200:
            return f"Emergency Clean-Air Mobilization for {city}: Transit, Zero-Burning & Clean-Air Shelters"
        if aqi > 100:
            return f"{city} Shared-Mobility & Dust-Free Commute Drive"
        return f"Keep {city} Breathing Clean: Everyday Transit, Composting & Canopy Action"

    @staticmethod
    def _build_policy_summaries(aqi: int, country: str) -> List[PolicySummaryItem]:
        summaries: List[PolicySummaryItem] = []
        if "india" in country or aqi >= 200:
            grap_stage = (
                "Stage IV (Severe+, >450)"
                if aqi > 450
                else "Stage III (Severe, 401–450)"
                if aqi > 400
                else "Stage II (Very Poor, 301–400)"
                if aqi > 300
                else "Stage I (Poor, 201–300)"
                if aqi >= 201
                else "Preventive Baseline Monitoring (<200)"
            )
            summaries.append(
                PolicySummaryItem(
                    title="CPCB / CAQM Graded Response Action Plan (GRAP)",
                    jurisdiction="India / NCR & National Urban Corridors",
                    summary="Escalating clean-air enforcement covering mechanized road sweeping, anti-burning bans, diesel generator curbs, and transit boosts.",
                    applicable_status=f"Current alignment: {grap_stage}",
                    source_url="https://airquality.cpcb.gov.in/",
                )
            )
        summaries.append(
            PolicySummaryItem(
                title="US EPA 2024 PM2.5 NAAQS & AirNow Action Guide",
                jurisdiction="United States / Global US-AQI Reference",
                summary="Tightens primary annual PM2.5 protection and guides school/workplace outdoor activity reduction when AQI exceeds 100.",
                applicable_status=f"Current US-AQI band check ({aqi})",
                source_url="https://www.airnow.gov/aqi/aqi-basics/",
            )
        )
        summaries.append(
            PolicySummaryItem(
                title="WHO Global Air Quality Guidelines (2021)",
                jurisdiction="Global Public Health Benchmark",
                summary="Recommends 24h PM2.5 <= 15 µg/m³ and NO₂ <= 25 µg/m³ alongside clean urban energy and active transit policy shifts.",
                applicable_status="Active health benchmark comparison",
                source_url="https://www.who.int/publications/i/item/9789240034228",
            )
        )
        return summaries


community_action_agent = CommunityActionAgent()
