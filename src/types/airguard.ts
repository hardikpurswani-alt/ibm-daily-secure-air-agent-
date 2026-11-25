export type ObservationType =
  | 'official_monitoring_station'
  | 'modelled_estimate'
  | 'forecast'
  | 'unavailable'

export type FreshnessLevel = 'fresh' | 'aging' | 'stale' | 'unavailable'

export type AQILevel =
  | 'Good'
  | 'Moderate'
  | 'Unhealthy for Sensitive Groups'
  | 'Unhealthy'
  | 'Very Unhealthy'
  | 'Hazardous'
  | 'Unavailable'

export type PageId =
  | 'dashboard'
  | 'live'
  | 'map'
  | 'historical'
  | 'forecast'
  | 'health'
  | 'alerts'
  | 'community'
  | 'assistant'
  | 'settings'

export interface SourceAttribution {
  source_name: string
  source_url?: string | null
  observation_type: ObservationType
  station_id?: string | null
  station_name?: string | null
  distance_km?: number | null
  observed_at?: string | null
  fetched_at: string
  freshness: FreshnessLevel
  freshness_minutes?: number | null
}

export interface PollutantReading {
  code: 'PM2.5' | 'PM10' | 'CO' | 'NO2' | 'SO2' | 'O3' | 'NH3' | 'Pb'
  name: string
  available: boolean
  value: number | null
  unit: string
  sub_index: number | null
  observation_type: ObservationType
  source_name: string
  observed_at?: string | null
  who_guideline_24h?: string | null
  exceeds_who?: boolean | null
  trend: 'up' | 'down' | 'stable' | 'unknown'
  change_percent?: number | null
  status_note?: string | null
}

export interface LocationInfo {
  query: string
  city: string
  region: string
  country: string
  latitude: number
  longitude: number
  timezone: string
}

export interface LocationSuggestion {
  name: string
  region: string
  country: string
  country_code: string
  latitude: number
  longitude: number
  timezone: string
}

export interface MeteorologyContext {
  temperature_c: number | null
  relative_humidity_pct: number | null
  wind_speed_kmh: number | null
  wind_direction_deg: number | null
  surface_pressure_hpa: number | null
  uv_index: number | null
  dust_ugm3: number | null
  source_name: string
  observed_at?: string | null
}

export interface ValidationReport {
  valid: boolean
  checks_passed: string[]
  warnings: string[]
}

export interface HotspotStation {
  station_id: string
  name: string
  city: string
  latitude: number
  longitude: number
  aqi: number | null
  aqi_scale: string
  level: AQILevel
  dominant_pollutant?: string | null
  observation_type: ObservationType
  source_name: string
  observed_at?: string | null
  distance_km?: number | null
  is_hotspot: boolean
}

export interface LiveAQIResponse {
  location: LocationInfo
  aqi: number | null
  aqi_scale: string
  level: AQILevel
  us_aqi: number | null
  european_aqi: number | null
  india_naqi: number | null
  dominant_pollutant: string | null
  pollutants: PollutantReading[]
  meteorology: MeteorologyContext | null
  primary_source: SourceAttribution
  supplementary_sources: SourceAttribution[]
  validation: ValidationReport
  hotspots: HotspotStation[]
  summary: string
}

export interface HistoricalPoint {
  timestamp: string
  aqi: number | null
  pm25: number | null
  pm10: number | null
  o3: number | null
  no2: number | null
  so2: number | null
  co: number | null
  nh3: number | null
}

export interface HistoricalAnalyticsResponse {
  location: LocationInfo
  observation_type: ObservationType
  source_name: string
  fetched_at: string
  hours: number
  points: HistoricalPoint[]
  stats: {
    min_aqi: number | null
    max_aqi: number | null
    avg_aqi: number | null
    avg_pm25: number | null
    exceedance_hours_over_100: number
    peak_timestamp: string | null
  }
}

export interface RAGCitation {
  doc_id: string
  title: string
  section: string
  source_org: string
  source_url: string
  published_year: string
  relevance_score: number
  excerpt: string
}

export interface HealthProfileInput {
  age_group: 'child' | 'adult' | 'older_adult'
  outdoor_activity: 'low' | 'moderate' | 'high' | 'outdoor_worker'
  health_considerations: string[]
}

export interface RiskGroupAdvisory {
  risk_group: string
  risk_level: 'Low' | 'Moderate' | 'High' | 'Very High' | 'Critical'
  summary: string
  precautions: string[]
  outdoor_adjustment: string
  mask_guidance: string
  indoor_air_guidance: string
  avoid_activities: string[]
}

export interface HealthAdvisoryResponse {
  location: string
  aqi: number | null
  level: AQILevel
  personalized_risk_level: 'Low' | 'Moderate' | 'High' | 'Very High' | 'Critical'
  profile_used: HealthProfileInput
  headline_recommendation: string
  daily_precautions: string[]
  outdoor_activity_guidance: string
  mask_and_indoor_guidance: string
  group_advisories: RiskGroupAdvisory[]
  reasoning_mode: 'ibm_watsonx_granite' | 'deterministic_evidence_synthesis'
  granite_analysis: string
  citations: RAGCitation[]
  medical_disclaimer: string
  generated_at: string
}

export interface ForecastPoint {
  timestamp: string
  predicted_aqi: number
  uncertainty_low: number
  uncertainty_high: number
  confidence_pct: number
  uncertainty_label: 'Low Uncertainty' | 'Moderate Uncertainty' | 'Higher Uncertainty'
  level: AQILevel
  pm25: number | null
  pm10: number | null
  o3: number | null
  drivers: string[]
}

export interface UnhealthyWindow {
  start_time: string
  end_time: string
  peak_aqi: number
  level: AQILevel
  severity: 'info' | 'warning' | 'critical'
  summary: string
  preventive_action: string
}

export interface ForecastResponse {
  location: string
  observation_type: 'forecast'
  source_name: string
  generated_at: string
  horizon_hours: number
  trend_direction: 'improving' | 'stable' | 'worsening' | 'variable'
  confidence_note: string
  forecasts: ForecastPoint[]
  unhealthy_windows: UnhealthyWindow[]
  preventive_recommendations: string[]
  reasoning_mode: 'ibm_watsonx_granite' | 'deterministic_evidence_synthesis'
  granite_reasoning: string
  citations: RAGCitation[]
}

export interface CommunityActionItem {
  id: string
  title: string
  description: string
  category: 'transport' | 'waste' | 'plantation' | 'energy_indoor' | 'civic_advocacy'
  impact: 'high' | 'medium'
  difficulty: 'easy' | 'moderate' | 'ambitious'
  pledge_count: number
  user_pledged: boolean
  tags: string[]
}

export interface PolicySummaryItem {
  title: string
  jurisdiction: string
  summary: string
  applicable_status: string
  source_url: string
}

export interface CommunityInsightResponse {
  location: string
  aqi: number | null
  dominant_source_hypothesis: string
  local_report_count: number
  campaign_headline: string
  actions: CommunityActionItem[]
  policy_summaries: PolicySummaryItem[]
  recent_reports: Array<{ id: string; category: string; description: string; created_at: string }>
  reasoning_mode: 'ibm_watsonx_granite' | 'deterministic_evidence_synthesis'
  granite_analysis: string
  citations: RAGCitation[]
  generated_at: string
}

export interface AgentExecutionStep {
  agent_name:
    | 'MainCoordinator'
    | 'AQIDataAgent'
    | 'HealthAdvisoryAgent'
    | 'ForecastingAgent'
    | 'CommunityActionAgent'
    | 'RAGKnowledgeSystem'
  status: 'completed' | 'degraded' | 'failed' | 'skipped'
  latency_ms: number
  summary: string
  data_provenance?: string | null
}

export interface UnifiedBriefingResponse {
  city: string
  generated_at: string
  coordinator_agent_id: string
  orchestration_mode: 'watsonx_orchestrate_live' | 'local_coordinator_with_granite' | 'local_coordinator'
  live_aqi: LiveAQIResponse
  historical: HistoricalAnalyticsResponse
  health_advisory: HealthAdvisoryResponse
  forecast: ForecastResponse
  community: CommunityInsightResponse
  agent_trace: AgentExecutionStep[]
}

export interface ChatMessageItem {
  id: string
  role: 'user' | 'assistant'
  content: string
  trace: AgentExecutionStep[]
  citations: RAGCitation[]
  coordinator_mode?: string
  created_at: string
}

export interface ChatResponse {
  session_id: string
  message_id: string
  reply: string
  city: string
  timestamp: string
  coordinator_agent_id: string
  orchestration_mode: 'watsonx_orchestrate_live' | 'local_coordinator_with_granite' | 'local_coordinator'
  orchestration_note?: string | null
  agent_trace: AgentExecutionStep[]
  citations: RAGCitation[]
  snapshot_aqi: number | null
  snapshot_source: string | null
}

export interface ChatSessionSummary {
  id: string
  city: string
  title: string
  created_at: string
}

export interface AlertItem {
  id: string
  city: string
  severity: 'info' | 'warning' | 'critical'
  category: string
  title: string
  message: string
  agent_source: string
  time_window: string
  read: boolean
  created_at: string
}

export interface PreferencesPayload {
  default_city: string
  saved_cities: string[]
  aqi_standard: 'us_epa' | 'india_naqi' | 'eu_eaqi'
  theme_preference: 'system' | 'light' | 'dark'
  alert_aqi_threshold: number
  notifications_enabled: boolean
  location_consent_granted: boolean
  location_consent_updated_at?: string | null
  age_group: 'child' | 'adult' | 'older_adult' | null
  outdoor_activity: 'low' | 'moderate' | 'high' | 'outdoor_worker' | null
  health_considerations: string[]
}

export interface SystemStatus {
  backend: string
  version: string
  database_driver: string
  data_sources: Record<string, Record<string, unknown>>
  rag_knowledge: {
    documents_indexed: number
    chunks_indexed: number
    embedding_boost: boolean
  }
  ibm_granite: {
    configured: boolean
    url: string
    model_id: string
    project_id_present: boolean
    mode: string
  }
  watsonx_orchestrate: {
    agent_id: string
    editor_url: string
    instance_url_configured: boolean
    api_key_configured: boolean
    connected: boolean
    agent_name?: string
    collaborators?: unknown[]
    tools?: unknown[]
    error?: string
  }
}

export interface AuthUser {
  id: string
  email: string
  full_name: string
}
