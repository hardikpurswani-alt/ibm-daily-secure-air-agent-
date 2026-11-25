"""Main Multi-Agent Coordinator connecting Existing watsonx Orchestrate Agent + 4 Specialist Agents + RAG."""

from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..models.db_models import AlertRecord, AQISnapshot, ChatMessage, ChatSession, UserPreference
from ..schemas.airguard import (
    AgentExecutionStep,
    ChatRequest,
    ChatResponse,
    HealthProfileInput,
    RAGCitation,
    UnifiedBriefingResponse,
)
from ..services.granite_service import granite_service
from ..services.orchestrate_client import orchestrate_client
from ..services.rag_service import rag_engine
from .aqi_data_agent import aqi_data_agent
from .community_agent import community_action_agent
from .forecasting_agent import forecasting_agent
from .health_agent import health_advisory_agent


def _load_profile(db: Session, owner_key: str, override: Optional[HealthProfileInput] = None) -> HealthProfileInput:
    if override is not None:
        return override
    pref = db.query(UserPreference).filter(UserPreference.owner_key == owner_key).first()
    if not pref:
        return HealthProfileInput()
    try:
        considerations = json.loads(pref.health_considerations_json or "[]")
    except Exception:
        considerations = []
    return HealthProfileInput(
        age_group=pref.age_group or "adult",  # type: ignore[arg-type]
        outdoor_activity=pref.outdoor_activity or "moderate",  # type: ignore[arg-type]
        health_considerations=considerations if isinstance(considerations, list) else [],
    )


class MultiAgentCoordinator:
    """Coordinates AQI Data, Health Advisory, Forecasting, Community Action, RAG, Granite, and watsonx Orchestrate."""

    async def run_unified_briefing(
        self,
        city: str,
        db: Session,
        owner_key: str,
        lat: Optional[float] = None,
        lon: Optional[float] = None,
        profile_override: Optional[HealthProfileInput] = None,
    ) -> UnifiedBriefingResponse:
        settings = get_settings()
        trace: List[AgentExecutionStep] = []

        # Step 1: AQI Data Agent (Live + Historical)
        t0 = time.monotonic()
        live, historical = await asyncio.gather(
            aqi_data_agent.get_live_aqi(city=city, lat=lat, lon=lon),
            aqi_data_agent.get_historical_analytics(city=city, hours=48, lat=lat, lon=lon),
        )
        t_data = int((time.monotonic() - t0) * 1000)
        trace.append(
            AgentExecutionStep(
                agent_name="AQIDataAgent",
                status="completed",
                latency_ms=t_data,
                summary=live.summary,
                data_provenance=f"{live.primary_source.source_name} ({live.primary_source.observation_type})",
            )
        )

        # Persist validated telemetry snapshot
        if live.aqi is not None:
            db.add(
                AQISnapshot(
                    city=live.location.city,
                    latitude=live.location.latitude,
                    longitude=live.location.longitude,
                    aqi=live.aqi,
                    aqi_scale=live.aqi_scale,
                    observation_type=live.primary_source.observation_type,
                    source_name=live.primary_source.source_name,
                    observed_at=live.primary_source.observed_at or live.primary_source.fetched_at,
                    payload_json=live.model_dump_json(),
                )
            )
            db.commit()

        profile = _load_profile(db, owner_key, override=profile_override)

        # Step 2: Parallel execution of Health Advisory, Forecasting, and Community Action Agents
        t1 = time.monotonic()
        health, forecast, community = await asyncio.gather(
            health_advisory_agent.generate(live=live, profile=profile),
            forecasting_agent.generate(live=live, historical=historical.points, horizon_hours=48),
            community_action_agent.generate(live=live, db=db, owner_key=owner_key),
        )
        t_phase2 = int((time.monotonic() - t1) * 1000)

        trace.extend(
            [
                AgentExecutionStep(
                    agent_name="HealthAdvisoryAgent",
                    status="completed",
                    latency_ms=t_phase2,
                    summary=f"Risk={health.personalized_risk_level} ({health.reasoning_mode})",
                    data_provenance=f"RAG ({len(health.citations)} sources)",
                ),
                AgentExecutionStep(
                    agent_name="ForecastingAgent",
                    status="completed",
                    latency_ms=t_phase2,
                    summary=f"48h trend={forecast.trend_direction}, {len(forecast.unhealthy_windows)} unhealthy window(s)",
                    data_provenance=forecast.source_name,
                ),
                AgentExecutionStep(
                    agent_name="CommunityActionAgent",
                    status="completed",
                    latency_ms=t_phase2,
                    summary=f"{len(community.actions)} actions, {community.local_report_count} local reports",
                    data_provenance=f"DB + RAG ({len(community.citations)} policies)",
                ),
            ]
        )

        # Evaluate and persist threshold/forecast alerts for user
        self._sync_alerts(db=db, owner_key=owner_key, live=live, forecast=forecast)

        orch_mode = (
            "watsonx_orchestrate_live"
            if settings.is_orchestrate_configured
            else "local_coordinator_with_granite"
            if settings.is_granite_configured
            else "local_coordinator"
        )
        trace.insert(
            0,
            AgentExecutionStep(
                agent_name="MainCoordinator",
                status="completed",
                latency_ms=t_data + t_phase2,
                summary=f"Coordinated 4 specialist agents for {live.location.city} (Coordinator ID {settings.watsonx_orchestrate_agent_id}).",
                data_provenance=orch_mode,
            ),
        )

        return UnifiedBriefingResponse(
            city=live.location.city,
            generated_at=datetime.now(timezone.utc).isoformat(),
            coordinator_agent_id=settings.watsonx_orchestrate_agent_id,
            orchestration_mode=orch_mode,  # type: ignore[arg-type]
            live_aqi=live,
            historical=historical,
            health_advisory=health,
            forecast=forecast,
            community=community,
            agent_trace=trace,
        )

    async def handle_chat(
        self,
        req: ChatRequest,
        db: Session,
        owner_key: str,
    ) -> ChatResponse:
        settings = get_settings()
        briefing = await self.run_unified_briefing(
            city=req.city,
            db=db,
            owner_key=owner_key,
            profile_override=req.health_profile,
        )
        trace = list(briefing.agent_trace)

        # RAG lookup specific to user's conversational intent
        t_rag = time.monotonic()
        rag_hits = rag_engine.retrieve(f"{req.message} {req.city} AQI {briefing.live_aqi.aqi}", top_k=4)
        trace.append(
            AgentExecutionStep(
                agent_name="RAGKnowledgeSystem",
                status="completed",
                latency_ms=int((time.monotonic() - t_rag) * 1000),
                summary=f"Retrieved {len(rag_hits)} policy & health citations.",
                data_provenance="Local Environmental Knowledge Store",
            )
        )

        # Deduplicate citations
        seen_keys = set()
        merged_citations: List[RAGCitation] = []
        for c in [*rag_hits, *briefing.health_advisory.citations, *briefing.community.citations]:
            k = (c.doc_id, c.section)
            if k not in seen_keys:
                seen_keys.add(k)
                merged_citations.append(c)

        grounded_context = self._build_grounded_context(briefing, merged_citations[:5])

        # Create or reuse DB chat session
        session = None
        if req.session_id:
            session = (
                db.query(ChatSession)
                .filter(ChatSession.id == req.session_id, ChatSession.owner_key == owner_key)
                .first()
            )
        if not session:
            session = ChatSession(
                owner_key=owner_key,
                city=briefing.live_aqi.location.city,
                title=req.message[:80],
            )
            db.add(session)
            db.flush()

        user_msg = ChatMessage(session_id=session.id, role="user", content=req.message)
        db.add(user_msg)

        # Attempt live existing IBM watsonx Orchestrate coordinator first if configured
        reply_text: Optional[str] = None
        orch_note: Optional[str] = None
        orch_mode = briefing.orchestration_mode

        if settings.is_orchestrate_configured:
            reply_text, orch_err = await orchestrate_client.invoke_coordinator_chat(
                user_message=req.message,
                grounded_context=grounded_context,
                thread_id=session.id,
            )
            if reply_text:
                orch_mode = "watsonx_orchestrate_live"
                orch_note = f"Response generated via existing IBM watsonx Orchestrate agent {settings.watsonx_orchestrate_agent_id}."
            else:
                orch_note = f"watsonx Orchestrate fallback active: {orch_err}"

        # Next attempt direct IBM Granite reasoning if Orchestrate wasn't live
        if not reply_text and settings.is_granite_configured:
            g_reply, g_err = granite_service.chat(
                system_prompt=(
                    "You are AirGuard AI's Coordinator Assistant synthesizing outputs from four specialist agents "
                    "(AQI Data, Health Advisory, Forecasting, Community Action) and verified RAG sources. "
                    "Cite exact figures, timestamps, sources, and forecast uncertainty. Never fabricate AQI numbers "
                    "or make medical diagnoses."
                ),
                user_prompt=f"{grounded_context}\n\nUser question: {req.message}",
                max_tokens=450,
            )
            if g_reply:
                reply_text = g_reply
                orch_mode = "local_coordinator_with_granite"
                orch_note = (
                    orch_note
                    or "Answered via IBM Granite (watsonx.ai) grounded with all 4 specialist agents; connect Orchestrate API credentials in .env for live cloud coordinator routing."
                )
            else:
                orch_note = f"{orch_note or ''} Granite fallback: {g_err}".strip()

        # Final deterministic evidence-based synthesis if IBM credentials are not yet configured
        if not reply_text:
            orch_mode = "local_coordinator"
            orch_note = (
                orch_note
                or "IBM watsonx Orchestrate / Granite API credentials are not configured yet; response synthesized strictly from live AQI APIs, 4 specialist agents, and RAG citations."
            )
            reply_text = self._synthesize_evidence_reply(req.message, briefing, merged_citations[:4])

        assistant_msg = ChatMessage(
            session_id=session.id,
            role="assistant",
            content=reply_text,
            trace_json=json.dumps([t.model_dump() for t in trace]),
            citations_json=json.dumps([c.model_dump() for c in merged_citations[:5]]),
            coordinator_mode=orch_mode,
        )
        db.add(assistant_msg)
        db.commit()

        return ChatResponse(
            session_id=session.id,
            message_id=assistant_msg.id,
            reply=reply_text,
            city=briefing.live_aqi.location.city,
            timestamp=datetime.now(timezone.utc).isoformat(),
            coordinator_agent_id=settings.watsonx_orchestrate_agent_id,
            orchestration_mode=orch_mode,  # type: ignore[arg-type]
            orchestration_note=orch_note,
            agent_trace=trace,
            citations=merged_citations[:5],
            snapshot_aqi=briefing.live_aqi.aqi,
            snapshot_source=briefing.live_aqi.primary_source.source_name,
        )

    @staticmethod
    def _build_grounded_context(briefing: UnifiedBriefingResponse, citations: List[RAGCitation]) -> str:
        live = briefing.live_aqi
        health = briefing.health_advisory
        fc = briefing.forecast
        comm = briefing.community
        pol_summary = ", ".join(
            f"{p.code}={p.value}{p.unit}" for p in live.pollutants if p.available and p.value is not None
        )
        cites = "\n".join(f"- {c.title} ({c.section}): {c.excerpt} [{c.source_url}]" for c in citations)
        return (
            f"Location: {live.location.city}, {live.location.country}\n"
            f"Live AQI: {live.aqi} ({live.level}) via {live.primary_source.source_name} "
            f"[{live.primary_source.observation_type}], observed_at={live.primary_source.observed_at}\n"
            f"Pollutants: {pol_summary}\n"
            f"Health Advisory ({health.personalized_risk_level}): {health.headline_recommendation} | "
            f"Outdoor: {health.outdoor_activity_guidance} | Mask/Indoor: {health.mask_and_indoor_guidance}\n"
            f"Forecast (48h trend={fc.trend_direction}): {fc.granite_reasoning}\n"
            f"Community Action: {comm.campaign_headline} | Driver: {comm.dominant_source_hypothesis}\n"
            f"RAG Citations:\n{cites}"
        )

    @staticmethod
    def _synthesize_evidence_reply(
        question: str,
        briefing: UnifiedBriefingResponse,
        citations: List[RAGCitation],
    ) -> str:
        q = question.lower()
        live = briefing.live_aqi
        h = briefing.health_advisory
        f = briefing.forecast
        c = briefing.community
        src_line = (
            f"Source: {live.primary_source.source_name} ({live.primary_source.observation_type.replace('_', ' ')}, "
            f"observed {live.primary_source.observed_at or live.primary_source.fetched_at})."
        )

        sections = [
            f"**Current Air Quality in {live.location.city}:** AQI **{live.aqi}** (**{live.level}**, {live.aqi_scale}), dominant pollutant **{live.dominant_pollutant}**. {src_line}"
        ]

        if any(w in q for w in ("safe", "precaution", "outdoor", "activity", "mask", "exercise", "health", "today")):
            sections.append(
                f"**Health & Activity Guidance ({h.personalized_risk_level} Risk):** {h.headline_recommendation} "
                f"{h.outdoor_activity_guidance} {h.mask_and_indoor_guidance}"
            )
        if any(w in q for w in ("tomorrow", "forecast", "predict", "later", "week", "trend", "safe")):
            sections.append(f"**Forecast & Uncertainty:** {f.granite_reasoning}")
        if any(w in q for w in ("community", "reduce", "policy", "we do", "carpool", "tree", "burn")):
            top_actions = "; ".join(a.title for a in c.actions[:3])
            sections.append(
                f"**Community Action & Policy:** Likely emission driver: {c.dominant_source_hypothesis}. "
                f"High-impact steps: {top_actions}."
            )
        if len(sections) == 1:
            sections.append(f"**Recommended Actions:** {h.headline_recommendation}")
            sections.append(f"**Outlook:** {f.granite_reasoning}")

        sections.append(f"*{h.medical_disclaimer}*")
        if citations:
            refs = " | ".join(f"{cit.title} ({cit.section})" for cit in citations[:3])
            sections.append(f"**References:** {refs}")
        return "\n\n".join(sections)

    @staticmethod
    def _sync_alerts(db: Session, owner_key: str, live, forecast) -> None:
        pref = db.query(UserPreference).filter(UserPreference.owner_key == owner_key).first()
        threshold = pref.alert_aqi_threshold if pref else 100
        if pref and not pref.notifications_enabled:
            return

        candidates = []
        if live.aqi is not None and live.aqi >= threshold:
            sev = "critical" if live.aqi > 200 else "warning"
            candidates.append(
                (
                    "realtime_threshold",
                    sev,
                    f"{live.location.city} AQI Alert ({live.aqi})",
                    f"{live.location.city} reached {live.aqi} ({live.level}), exceeding your alert threshold of {threshold}. Dominant: {live.dominant_pollutant}.",
                    "AQIDataAgent",
                    "Now",
                )
            )
        for win in forecast.unhealthy_windows[:2]:
            candidates.append(
                (
                    "predictive_spike",
                    win.severity,
                    f"Upcoming {win.level} Window in {live.location.city}",
                    f"{win.summary} {win.preventive_action}",
                    "ForecastingAgent",
                    f"{win.start_time[11:16]}–{win.end_time[11:16]}",
                )
            )

        for cat, sev, title, msg, src, win_str in candidates:
            exists = (
                db.query(AlertRecord)
                .filter(
                    AlertRecord.owner_key == owner_key,
                    AlertRecord.city == live.location.city,
                    AlertRecord.title == title,
                    AlertRecord.dismissed == False,  # noqa: E712
                )
                .first()
            )
            if not exists:
                db.add(
                    AlertRecord(
                        owner_key=owner_key,
                        city=live.location.city,
                        severity=sev,
                        category=cat,
                        title=title,
                        message=msg,
                        agent_source=src,
                        time_window=win_str,
                    )
                )
        db.commit()


coordinator = MultiAgentCoordinator()
