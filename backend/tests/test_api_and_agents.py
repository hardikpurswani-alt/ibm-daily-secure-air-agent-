"""Comprehensive backend API, database, RAG, and multi-agent integration tests."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Point DB to a temporary SQLite file for isolated test execution
_TMP_DB = Path(tempfile.gettempdir()) / "airguard_test.db"
if _TMP_DB.exists():
    _TMP_DB.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP_DB}"
os.environ["WAQI_API_TOKEN"] = "demo"  # Verify 'demo' is strictly rejected

from app.core.config import get_settings  # noqa: E402
from app.core.database import init_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    get_settings.cache_clear()
    init_db()
    with TestClient(app) as c:
        yield c


def test_health_and_waqi_demo_rejected(client: TestClient):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["coordinator_agent_id"] == "9804aee5-5298-40dc-930c-46d17a839fde"
    assert get_settings().has_valid_waqi_token is False


def test_auth_register_login_and_preferences(client: TestClient):
    reg = client.post(
        "/api/v1/auth/register",
        json={"email": "analyst@airguard.local", "full_name": "Air Analyst", "password": "StrongPassword123!"},
    )
    assert reg.status_code == 201
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["authenticated"] is True
    assert me.json()["user"]["email"] == "analyst@airguard.local"

    # Update preferences with health considerations + consent
    put_pref = client.put(
        "/api/v1/preferences",
        headers=headers,
        json={
            "default_city": "Delhi",
            "saved_cities": ["Delhi", "Sydney"],
            "aqi_standard": "india_naqi",
            "theme_preference": "dark",
            "alert_aqi_threshold": 120,
            "notifications_enabled": True,
            "location_consent_granted": True,
            "age_group": "adult",
            "outdoor_activity": "high",
            "health_considerations": ["asthma"],
        },
    )
    assert put_pref.status_code == 200
    assert put_pref.json()["health_considerations"] == ["asthma"]
    assert put_pref.json()["location_consent_granted"] is True

    # Explicitly delete optional health profile
    del_health = client.delete("/api/v1/preferences/health", headers=headers)
    assert del_health.status_code == 200
    assert del_health.json()["health_considerations"] == []
    assert del_health.json()["age_group"] is None


def test_rag_knowledge_retrieval(client: TestClient):
    docs = client.get("/api/v1/rag/documents")
    assert docs.status_code == 200
    assert len(docs.json()["documents"]) >= 5

    search = client.get("/api/v1/rag/search", params={"q": "PM2.5 N95 mask HEPA indoor WHO guideline"})
    assert search.status_code == 200
    cites = search.json()["citations"]
    assert len(cites) >= 2
    assert all(c["source_url"].startswith("https://") for c in cites)


def test_live_aqi_cpcb_and_open_meteo_no_fake_pb(client: TestClient):
    res = client.get("/api/v1/aqi/live", params={"city": "Delhi"})
    assert res.status_code == 200
    data = res.json()
    assert data["location"]["city"].lower().startswith("delhi")
    assert isinstance(data["aqi"], int) and 0 <= data["aqi"] <= 500
    codes = {p["code"]: p for p in data["pollutants"]}
    for expected in ("PM2.5", "PM10", "CO", "NO2", "SO2", "O3", "NH3", "Pb"):
        assert expected in codes
    # Pb must be marked unavailable rather than fabricated
    assert codes["Pb"]["available"] is False
    assert codes["Pb"]["value"] is None
    assert data["primary_source"]["observation_type"] in ("official_monitoring_station", "modelled_estimate")


def test_unified_briefing_chat_pledges_and_alerts(client: TestClient):
    headers = {"X-Session-ID": "pytest-session-01"}

    briefing = client.get("/api/v1/agents/briefing", params={"city": "Sydney"}, headers=headers)
    assert briefing.status_code == 200
    b = briefing.json()
    assert b["coordinator_agent_id"] == "9804aee5-5298-40dc-930c-46d17a839fde"
    assert len(b["agent_trace"]) == 5
    assert len(b["forecast"]["forecasts"]) >= 24
    assert "diagnose" in b["health_advisory"]["medical_disclaimer"].lower()

    # Community pledge persistence
    pledge = client.post(
        "/api/v1/agents/community/pledges",
        json={"action_id": "carpool-transit", "city": "Sydney", "note": "Metro commute"},
        headers=headers,
    )
    assert pledge.status_code == 200
    assert pledge.json()["user_pledged"] is True
    assert pledge.json()["pledge_count"] >= 1

    # Citizen pollution report persistence
    rep = client.post(
        "/api/v1/agents/community/reports",
        json={"city": "Sydney", "category": "construction_dust", "description": "Uncovered gravel haulage near Parramatta"},
        headers=headers,
    )
    assert rep.status_code == 201

    # Chat assistant & session persistence
    chat = client.post(
        "/api/v1/orchestrate/chat",
        json={"message": "Is the air safe today and what precautions should I take?", "city": "Delhi"},
        headers=headers,
    )
    assert chat.status_code == 200
    c_body = chat.json()
    assert c_body["session_id"]
    assert len(c_body["citations"]) >= 1
    assert c_body["snapshot_aqi"] is not None

    sessions = client.get("/api/v1/orchestrate/sessions", headers=headers)
    assert sessions.status_code == 200
    assert any(s["id"] == c_body["session_id"] for s in sessions.json())


def test_orchestrate_tools_and_inspect_status(client: TestClient):
    status_res = client.get("/api/v1/system/status")
    assert status_res.status_code == 200
    st = status_res.json()
    assert st["watsonx_orchestrate"]["agent_id"] == "9804aee5-5298-40dc-930c-46d17a839fde"
    # Without IBM credentials, connected must honestly report False
    assert st["watsonx_orchestrate"]["connected"] is False

    tool_aqi = client.get("/api/v1/tools/aqi-data", params={"city": "New York"})
    assert tool_aqi.status_code == 200
    assert tool_aqi.json()["location"]["city"] == "New York"

    tool_rag = client.get("/api/v1/tools/rag-lookup", params={"query": "GRAP Stage III"})
    assert tool_rag.status_code == 200
    assert len(tool_rag.json()["citations"]) >= 1


def test_unknown_location_returns_clean_error_not_fake_data(client: TestClient):
    res = client.get("/api/v1/aqi/live", params={"city": "Zxqvk999NotARealCityXYZ"})
    assert res.status_code == 404
    assert "error" in res.json()


def test_historical_forecast_community_alerts_and_auth_guards(client: TestClient):
    headers = {"X-Session-ID": "pytest-session-01"}

    # Location search autocomplete
    loc = client.get("/api/v1/aqi/search-locations", params={"q": "Mumbai"})
    assert loc.status_code == 200
    assert len(loc.json()) >= 1

    # Historical analytics
    hist = client.get("/api/v1/aqi/historical", params={"city": "Delhi", "hours": 24})
    assert hist.status_code == 200
    assert len(hist.json()["points"]) == 24

    # Individual specialist agent endpoints
    health = client.post(
        "/api/v1/agents/health-advisory",
        params={"city": "Delhi"},
        json={"age_group": "older_adult", "outdoor_activity": "low", "health_considerations": ["asthma"]},
    )
    assert health.status_code == 200
    assert health.json()["personalized_risk_level"] in ("Low", "Moderate", "High", "Very High", "Critical")

    fc = client.get("/api/v1/agents/forecast", params={"city": "Delhi", "horizon_hours": 24})
    assert fc.status_code == 200
    assert len(fc.json()["forecasts"]) == 24

    comm = client.get("/api/v1/agents/community", params={"city": "Delhi"}, headers=headers)
    assert comm.status_code == 200
    assert len(comm.json()["policy_summaries"]) >= 2

    # Alerts lifecycle (list -> read -> mark all read -> dismiss)
    alerts = client.get("/api/v1/alerts", headers=headers)
    assert alerts.status_code == 200
    if alerts.json():
        aid = alerts.json()[0]["id"]
        assert client.post(f"/api/v1/alerts/{aid}/read", headers=headers).status_code == 200
        assert client.post("/api/v1/alerts/mark-all-read", headers=headers).status_code == 200
        assert client.delete(f"/api/v1/alerts/{aid}", headers=headers).status_code == 200

    # Invalid login rejected with 401
    bad_login = client.post(
        "/api/v1/auth/login",
        json={"email": "analyst@airguard.local", "password": "WrongPassword!"},
    )
    assert bad_login.status_code == 401

    # Location consent revocation endpoint
    revoke = client.delete("/api/v1/preferences/location-consent", headers=headers)
    assert revoke.status_code == 200
    assert revoke.json()["location_consent_granted"] is False

