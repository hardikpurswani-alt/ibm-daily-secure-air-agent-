"""Strict Pydantic v2 schemas for AirGuard AI APIs and multi-agent workflows."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field

ObservationType = Literal[
    "official_monitoring_station",
    "modelled_estimate",
    "forecast",
    "unavailable",
]

FreshnessLevel = Literal["fresh", "aging", "stale", "unavailable"]

AQILevel = Literal[
    "Good",
    "Moderate",
    "Unhealthy for Sensitive Groups",
    "Unhealthy",
    "Very Unhealthy",
    "Hazardous",
    "Unavailable",
]

ReasoningMode = Literal["ibm_watsonx_granite", "deterministic_evidence_synthesis"]


class SourceAttribution(BaseModel):
    source_name: str
    source_url: Optional[str] = None
    observation_type: ObservationType
    station_id: Optional[str] = None
    station_name: Optional[str] = None
    distance_km: Optional[float] = None
    observed_at: Optional[str] = None
    fetched_at: str
    freshness: FreshnessLevel
    freshness_minutes: Optional[int] = None


class PollutantReading(BaseModel):
    code: Literal["PM2.5", "PM10", "CO", "NO2", "SO2", "O3", "NH3", "Pb"]
    name: str
    available: bool
    value: Optional[float] = None
    unit: str
    sub_index: Optional[int] = None
    observation_type: ObservationType
    source_name: str
    observed_at: Optional[str] = None
    who_guideline_24h: Optional[str] = None
    exceeds_who: Optional[bool] = None
    trend: Literal["up", "down", "stable", "unknown"] = "unknown"
    change_percent: Optional[float] = None
    status_note: Optional[str] = None


class LocationInfo(BaseModel):
    query: str
    city: str
    region: str = ""
    country: str = ""
    latitude: float
    longitude: float
    timezone: str = "UTC"


class MeteorologyContext(BaseModel):
    temperature_c: Optional[float] = None
    relative_humidity_pct: Optional[int] = None
    wind_speed_kmh: Optional[float] = None
    wind_direction_deg: Optional[int] = None
    surface_pressure_hpa: Optional[float] = None
    uv_index: Optional[float] = None
    dust_ugm3: Optional[float] = None
    source_name: str = "Open-Meteo Weather & CAMS"
    observed_at: Optional[str] = None


class ValidationReport(BaseModel):
    valid: bool
    checks_passed: List[str]
    warnings: List[str] = Field(default_factory=list)


class HotspotStation(BaseModel):
    station_id: str
    name: str
    city: str
    latitude: float
    longitude: float
    aqi: Optional[int] = None
    aqi_scale: str = "US AQI / NAQI"
    level: AQILevel
    dominant_pollutant: Optional[str] = None
    observation_type: ObservationType
    source_name: str
    observed_at: Optional[str] = None
    distance_km: Optional[float] = None
    is_hotspot: bool = False


class LiveAQIResponse(BaseModel):
    location: LocationInfo
    aqi: Optional[int] = None
    aqi_scale: str
    level: AQILevel
    us_aqi: Optional[int] = None
    european_aqi: Optional[int] = None
    india_naqi: Optional[int] = None
    dominant_pollutant: Optional[str] = None
    pollutants: List[PollutantReading]
    meteorology: Optional[MeteorologyContext] = None
    primary_source: SourceAttribution
    supplementary_sources: List[SourceAttribution] = Field(default_factory=list)
    validation: ValidationReport
    hotspots: List[HotspotStation] = Field(default_factory=list)
    summary: str


class HistoricalPoint(BaseModel):
    timestamp: str
    aqi: Optional[int] = None
    pm25: Optional[float] = None
    pm10: Optional[float] = None
    o3: Optional[float] = None
    no2: Optional[float] = None
    so2: Optional[float] = None
    co: Optional[float] = None
    nh3: Optional[float] = None


class HistoricalAnalyticsResponse(BaseModel):
    location: LocationInfo
    observation_type: ObservationType
    source_name: str
    fetched_at: str
    hours: int
    points: List[HistoricalPoint]
    stats: Dict[str, Any]


class LocationSuggestion(BaseModel):
    name: str
    region: str = ""
    country: str = ""
    country_code: str = ""
    latitude: float
    longitude: float
    timezone: str = "UTC"


# ─── RAG & Citations ───────────────────────────────────────────────────────────

class RAGCitation(BaseModel):
    doc_id: str
    title: str
    section: str
    source_org: str
    source_url: str
    published_year: str
    relevance_score: float
    excerpt: str


# ─── Health Advisory Agent ────────────────────────────────────────────────────

class HealthProfileInput(BaseModel):
    age_group: Literal["child", "adult", "older_adult"] = "adult"
    outdoor_activity: Literal["low", "moderate", "high", "outdoor_worker"] = "moderate"
    health_considerations: List[str] = Field(default_factory=list)


class RiskGroupAdvisory(BaseModel):
    risk_group: str
    risk_level: Literal["Low", "Moderate", "High", "Very High", "Critical"]
    summary: str
    precautions: List[str]
    outdoor_adjustment: str
    mask_guidance: str
    indoor_air_guidance: str
    avoid_activities: List[str]


class HealthAdvisoryResponse(BaseModel):
    location: str
    aqi: Optional[int] = None
    level: AQILevel
    personalized_risk_level: Literal["Low", "Moderate", "High", "Very High", "Critical"]
    profile_used: HealthProfileInput
    headline_recommendation: str
    daily_precautions: List[str]
    outdoor_activity_guidance: str
    mask_and_indoor_guidance: str
    group_advisories: List[RiskGroupAdvisory]
    reasoning_mode: ReasoningMode
    granite_analysis: str
    citations: List[RAGCitation]
    medical_disclaimer: str
    generated_at: str


# ─── Forecasting Agent ────────────────────────────────────────────────────────

class ForecastPointSchema(BaseModel):
    timestamp: str
    predicted_aqi: int
    uncertainty_low: int
    uncertainty_high: int
    confidence_pct: int
    uncertainty_label: Literal["Low Uncertainty", "Moderate Uncertainty", "Higher Uncertainty"]
    level: AQILevel
    pm25: Optional[float] = None
    pm10: Optional[float] = None
    o3: Optional[float] = None
    drivers: List[str]


class UnhealthyWindow(BaseModel):
    start_time: str
    end_time: str
    peak_aqi: int
    level: AQILevel
    severity: Literal["info", "warning", "critical"]
    summary: str
    preventive_action: str


class ForecastResponse(BaseModel):
    location: str
    observation_type: Literal["forecast"] = "forecast"
    source_name: str
    generated_at: str
    horizon_hours: int
    trend_direction: Literal["improving", "stable", "worsening", "variable"]
    confidence_note: str
    forecasts: List[ForecastPointSchema]
    unhealthy_windows: List[UnhealthyWindow]
    preventive_recommendations: List[str]
    reasoning_mode: ReasoningMode
    granite_reasoning: str
    citations: List[RAGCitation]


# ─── Community Action Agent ───────────────────────────────────────────────────

class CommunityActionItem(BaseModel):
    id: str
    title: str
    description: str
    category: Literal["transport", "waste", "plantation", "energy_indoor", "civic_advocacy"]
    impact: Literal["high", "medium"]
    difficulty: Literal["easy", "moderate", "ambitious"]
    pledge_count: int
    user_pledged: bool = False
    tags: List[str]


class PolicySummaryItem(BaseModel):
    title: str
    jurisdiction: str
    summary: str
    applicable_status: str
    source_url: str


class CommunityInsightResponse(BaseModel):
    location: str
    aqi: Optional[int] = None
    dominant_source_hypothesis: str
    local_report_count: int
    campaign_headline: str
    actions: List[CommunityActionItem]
    policy_summaries: List[PolicySummaryItem]
    recent_reports: List[Dict[str, Any]]
    reasoning_mode: ReasoningMode
    granite_analysis: str
    citations: List[RAGCitation]
    generated_at: str


# ─── Orchestrator & Chat Assistant ────────────────────────────────────────────

class AgentExecutionStep(BaseModel):
    agent_name: Literal[
        "MainCoordinator",
        "AQIDataAgent",
        "HealthAdvisoryAgent",
        "ForecastingAgent",
        "CommunityActionAgent",
        "RAGKnowledgeSystem",
    ]
    status: Literal["completed", "degraded", "failed", "skipped"]
    latency_ms: int
    summary: str
    data_provenance: Optional[str] = None


class UnifiedBriefingResponse(BaseModel):
    city: str
    generated_at: str
    coordinator_agent_id: str
    orchestration_mode: Literal["watsonx_orchestrate_live", "local_coordinator_with_granite", "local_coordinator"]
    live_aqi: LiveAQIResponse
    historical: HistoricalAnalyticsResponse
    health_advisory: HealthAdvisoryResponse
    forecast: ForecastResponse
    community: CommunityInsightResponse
    agent_trace: List[AgentExecutionStep]


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    city: str = Field(default="Delhi", min_length=1, max_length=120)
    session_id: Optional[str] = None
    health_profile: Optional[HealthProfileInput] = None


class ChatResponse(BaseModel):
    session_id: str
    message_id: str
    reply: str
    city: str
    timestamp: str
    coordinator_agent_id: str
    orchestration_mode: Literal["watsonx_orchestrate_live", "local_coordinator_with_granite", "local_coordinator"]
    orchestration_note: Optional[str] = None
    agent_trace: List[AgentExecutionStep]
    citations: List[RAGCitation]
    snapshot_aqi: Optional[int] = None
    snapshot_source: Optional[str] = None


# ─── Auth, Preferences, Alerts, Community Mutations ───────────────────────────

class RegisterRequest(BaseModel):
    email: str = Field(min_length=4, max_length=255)
    full_name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]


class PreferencesPayload(BaseModel):
    default_city: str = Field(default="Delhi", min_length=1, max_length=120)
    saved_cities: List[str] = Field(default_factory=lambda: ["Delhi", "Sydney", "New York"])
    aqi_standard: Literal["us_epa", "india_naqi", "eu_eaqi"] = "us_epa"
    theme_preference: Literal["system", "light", "dark"] = "system"
    alert_aqi_threshold: int = Field(default=100, ge=25, le=450)
    notifications_enabled: bool = True
    location_consent_granted: bool = False
    age_group: Optional[Literal["child", "adult", "older_adult"]] = None
    outdoor_activity: Optional[Literal["low", "moderate", "high", "outdoor_worker"]] = None
    health_considerations: List[str] = Field(default_factory=list)


class PledgeRequest(BaseModel):
    action_id: str = Field(min_length=1, max_length=64)
    city: str = Field(min_length=1, max_length=120)
    note: Optional[str] = Field(default=None, max_length=280)


class PollutionReportRequest(BaseModel):
    city: str = Field(min_length=1, max_length=120)
    category: Literal["open_burning", "construction_dust", "traffic_congestion", "industrial_smoke", "other"]
    description: str = Field(min_length=5, max_length=600)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
