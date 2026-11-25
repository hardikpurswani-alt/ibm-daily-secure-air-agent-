// ─────────────────────────────────────────────────────────────────────────────
// AirGuard AI — Agent Types
// Multi-agent architecture types for IBM watsonx Orchestrate integration
// ─────────────────────────────────────────────────────────────────────────────

export type AQILevel = 'Good' | 'Moderate' | 'Unhealthy for Sensitive Groups' | 'Unhealthy' | 'Very Unhealthy' | 'Hazardous';

export interface AQIColors {
  bg: string;
  text: string;
  border: string;
  badge: string;
}

export const AQI_THRESHOLDS: Record<AQILevel, { min: number; max: number; color: AQIColors }> = {
  Good: { min: 0, max: 50, color: { bg: '#22c55e', text: '#fff', border: '#16a34a', badge: '#dcfce7' } },
  Moderate: { min: 51, max: 100, color: { bg: '#eab308', text: '#fff', border: '#ca8a04', badge: '#fef9c3' } },
  'Unhealthy for Sensitive Groups': { min: 101, max: 150, color: { bg: '#f97316', text: '#fff', border: '#ea580c', badge: '#ffedd5' } },
  Unhealthy: { min: 151, max: 200, color: { bg: '#ef4444', text: '#fff', border: '#dc2626', badge: '#fee2e2' } },
  'Very Unhealthy': { min: 201, max: 300, color: { bg: '#a855f7', text: '#fff', border: '#9333ea', badge: '#f3e8ff' } },
  Hazardous: { min: 301, max: 500, color: { bg: '#7f1d1d', text: '#fff', border: '#991b1b', badge: '#fecaca' } },
};

export function getAQILevel(aqi: number): AQILevel {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

// ─── AQI Data Agent Types ────────────────────────────────────────────────────

export interface Pollutant {
  name: string;
  value: number;
  unit: string;
  aqi: number;
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
}

export interface AQIReading {
  aqi: number;
  level: AQILevel;
  dominantPollutant: string;
  pollutants: Pollutant[];
  location: {
    city: string;
    state: string;
    country: string;
    lat: number;
    lon: number;
  };
  timestamp: string;
  stationId: string;
}

export interface HistoricalDataPoint {
  timestamp: string;
  aqi: number;
  pm25: number;
  pm10: number;
  o3: number;
  no2: number;
  so2: number;
  co: number;
}

// ─── Health Advisory Agent Types ─────────────────────────────────────────────

export type RiskGroup = 'General Public' | 'Children' | 'Elderly' | 'Respiratory Patients' | 'Cardiovascular Patients' | 'Athletes';

export interface HealthAdvisory {
  riskGroup: RiskGroup;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  recommendation: string;
  actions: string[];
  avoidActivities: string[];
  symptoms: string[];
  emergencyGuidance?: string;
  graniteInsight: string;
}

export interface PersonalProfile {
  ageGroup: 'child' | 'adult' | 'elderly';
  conditions: string[];
  activityLevel: 'sedentary' | 'moderate' | 'active';
}

// ─── Forecasting Agent Types ──────────────────────────────────────────────────

export interface ForecastPoint {
  timestamp: string;
  predictedAqi: number;
  confidence: number;
  level: AQILevel;
  factors: string[];
}

export interface AQIForecast {
  location: string;
  generatedAt: string;
  modelVersion: string;
  forecasts: ForecastPoint[];
  alerts: ForecastAlert[];
  graniteReasoning: string;
}

export interface ForecastAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timeWindow: string;
  affectedAreas: string[];
}

// ─── Community Action Agent Types ─────────────────────────────────────────────

export interface CommunityAction {
  id: string;
  title: string;
  description: string;
  category: 'reduce' | 'protect' | 'report' | 'advocate';
  impact: 'low' | 'medium' | 'high';
  difficulty: 'easy' | 'moderate' | 'hard';
  participants: number;
  verified: boolean;
  tags: string[];
}

export interface CommunityInsight {
  region: string;
  pollutionSource: string;
  reportCount: number;
  trend: 'improving' | 'stable' | 'worsening';
  communityActions: CommunityAction[];
  graniteAnalysis: string;
  lastUpdated: string;
}

// ─── Orchestrator Types ────────────────────────────────────────────────────────

export type AgentName = 'AQIDataAgent' | 'HealthAdvisoryAgent' | 'ForecastingAgent' | 'CommunityActionAgent';

export interface AgentStatus {
  name: AgentName;
  status: 'idle' | 'running' | 'success' | 'error';
  lastRun?: string;
  latency?: number;
  error?: string;
}

export interface OrchestratorState {
  agents: AgentStatus[];
  currentReading: AQIReading | null;
  historical: HistoricalDataPoint[];
  advisories: HealthAdvisory[];
  forecast: AQIForecast | null;
  communityInsights: CommunityInsight | null;
  notifications: Notification[];
  isLoading: boolean;
  lastRefresh: string | null;
}

export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'alert' | 'success';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  agentSource: AgentName;
}

// ─── IBM Granite Types ────────────────────────────────────────────────────────

export interface GraniteRequest {
  model: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  parameters?: {
    max_new_tokens?: number;
    temperature?: number;
    top_p?: number;
  };
}

export interface GraniteResponse {
  id: string;
  model: string;
  created: number;
  choices: { message: { role: string; content: string }; finish_reason: string }[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

// ─── Map Types ────────────────────────────────────────────────────────────────

export interface MapStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  aqi: number;
  level: AQILevel;
  city: string;
}
