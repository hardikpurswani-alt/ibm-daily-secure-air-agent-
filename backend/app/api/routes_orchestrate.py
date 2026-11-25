"""IBM watsonx Orchestrate chat, session history, and live diagnostics endpoints."""

from __future__ import annotations

import json
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..agents.coordinator import coordinator
from ..core.config import get_settings
from ..core.database import get_db
from ..core.security import resolve_owner_key
from ..models.db_models import ChatMessage, ChatSession
from ..schemas.airguard import ChatRequest, ChatResponse
from ..services.granite_service import granite_service
from ..services.orchestrate_client import orchestrate_client
from ..services.rag_service import rag_engine

router = APIRouter(prefix="/api/v1", tags=["Orchestrate & Diagnostics"])


@router.post("/orchestrate/chat", response_model=ChatResponse)
async def orchestrate_chat(
    req: ChatRequest,
    db: Session = Depends(get_db),
    owner_key: str = Depends(resolve_owner_key),
):
    """Send a natural-language query to the main AirGuard Coordinator (watsonx Orchestrate + 4 specialist agents)."""
    try:
        return await coordinator.handle_chat(req=req, db=db, owner_key=owner_key)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"Coordinator failed to complete turn: {exc}") from exc


@router.get("/orchestrate/sessions")
def list_chat_sessions(
    db: Session = Depends(get_db),
    owner_key: str = Depends(resolve_owner_key),
):
    """List saved AI Air Quality Assistant conversation threads."""
    rows = (
        db.query(ChatSession)
        .filter(ChatSession.owner_key == owner_key)
        .order_by(ChatSession.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id": s.id,
            "city": s.city,
            "title": s.title,
            "created_at": s.created_at.isoformat() if s.created_at else "",
        }
        for s in rows
    ]


@router.get("/orchestrate/sessions/{session_id}")
def get_chat_session_messages(
    session_id: str,
    db: Session = Depends(get_db),
    owner_key: str = Depends(resolve_owner_key),
):
    """Retrieve messages, agent traces, and RAG citations for a saved chat session."""
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.owner_key == owner_key)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    msgs = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return {
        "session_id": session.id,
        "city": session.city,
        "title": session.title,
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "trace": json.loads(m.trace_json or "[]"),
                "citations": json.loads(m.citations_json or "[]"),
                "coordinator_mode": m.coordinator_mode,
                "created_at": m.created_at.isoformat() if m.created_at else "",
            }
            for m in msgs
        ],
    }


@router.get("/orchestrate/inspect-coordinator")
async def inspect_existing_coordinator() -> Dict[str, Any]:
    """Inspect the existing IBM watsonx Orchestrate coordinator agent (9804aee5-5298-40dc-930c-46d17a839fde)."""
    return await orchestrate_client.inspect_existing_coordinator()


@router.get("/system/status")
async def get_system_status() -> Dict[str, Any]:
    """Honest runtime integration status across data feeds, RAG, IBM Granite, and watsonx Orchestrate."""
    settings = get_settings()
    orch_info = await orchestrate_client.inspect_existing_coordinator()
    return {
        "backend": "online",
        "version": settings.app_version,
        "database_driver": "postgresql" if "postgres" in settings.database_url else "sqlite",
        "data_sources": {
            "cpcb_india_official": {"enabled": True, "auth_required": False, "url": "https://airquality.cpcb.gov.in/"},
            "open_meteo_air_and_weather": {"enabled": True, "auth_required": False, "url": "https://open-meteo.com/"},
            "nsw_epa_australia": {"enabled": True, "auth_required": False, "url": "https://www.airquality.nsw.gov.au/"},
            "waqi_station_api": {"enabled": settings.has_valid_waqi_token, "demo_rejected": True},
            "openaq_v3": {"enabled": bool(settings.openaq_api_key.strip())},
            "us_epa_airnow": {"enabled": bool(settings.airnow_api_key.strip())},
        },
        "rag_knowledge": {
            "documents_indexed": len(rag_engine.list_documents()),
            "chunks_indexed": len(rag_engine.chunks),
            "embedding_boost": settings.is_granite_configured,
        },
        "ibm_granite": granite_service.health_check(),
        "watsonx_orchestrate": orch_info,
    }
