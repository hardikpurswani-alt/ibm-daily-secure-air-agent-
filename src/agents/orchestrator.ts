// ─────────────────────────────────────────────────────────────────────────────
// IBM watsonx Orchestrate — Multi-Agent Coordinator
// Coordinates AQI Data, Health Advisory, Forecasting, and Community Action agents
// ─────────────────────────────────────────────────────────────────────────────

import { fetchCurrentAQI, fetchHistoricalAQI, fetchNearbyStations } from './aqiDataAgent';
import { generateHealthAdvisories } from './healthAdvisoryAgent';
import { generateForecast } from './forecastingAgent';
import { generateCommunityInsights } from './communityActionAgent';
import type {
  AgentName,
  AgentStatus,
  AQIReading,
  ForecastAlert,
  HistoricalDataPoint,
  MapStation,
  Notification,
  OrchestratorState,
} from './types';
import { getAQILevel } from './types';

type StateUpdater = (updater: (state: Partial<OrchestratorState>) => Partial<OrchestratorState>) => void;
type StateGetter = () => OrchestratorState;

/** Main orchestration function — runs all agents in coordinated sequence */
export async function runOrchestration(
  city: string,
  update: StateUpdater,
  get: StateGetter,
): Promise<void> {
  update(() => ({ isLoading: true }));

  const startTime = Date.now();

  // ── Phase 1: AQI Data Agent ──────────────────────────────────────────────
  updateAgentStatus('AQIDataAgent', 'running', update);
  let reading: AQIReading;
  let historical: HistoricalDataPoint[] = [];
  let stations: MapStation[] = [];

  try {
    [reading, historical] = await Promise.all([
      fetchCurrentAQI(city),
      (async () => {
        // We need coords from the reading first; use a placeholder lat/lon
        // Will refetch after reading
        return [] as HistoricalDataPoint[];
      })(),
    ]);

    [historical, stations] = await Promise.all([
      fetchHistoricalAQI(reading.location.lat, reading.location.lon),
      fetchNearbyStations(reading.location.lat, reading.location.lon),
    ]);

    updateAgentStatus('AQIDataAgent', 'success', update, Date.now() - startTime);
    update(() => ({
      currentReading: reading,
      historical,
    }));

    // Add notification for bad AQI
    if (reading.aqi > 100) {
      addNotification(
        {
          id: `aqi-alert-${Date.now()}`,
          type: reading.aqi > 150 ? 'alert' : 'warning',
          title: `Air Quality Alert: ${reading.level}`,
          message: `Current AQI is ${reading.aqi} in ${reading.location.city}. Take precautions.`,
          timestamp: new Date().toISOString(),
          read: false,
          agentSource: 'AQIDataAgent',
        },
        update,
        get,
      );
    }
  } catch (err) {
    updateAgentStatus('AQIDataAgent', 'error', update, undefined, String(err));
    update(() => ({ isLoading: false }));
    return;
  }

  // ── Phase 2: Run remaining agents in parallel ────────────────────────────
  const phase2Start = Date.now();

  updateAgentStatus('HealthAdvisoryAgent', 'running', update);
  updateAgentStatus('ForecastingAgent', 'running', update);
  updateAgentStatus('CommunityActionAgent', 'running', update);

  const [advisoriesResult, forecastResult, communityResult] = await Promise.allSettled([
    generateHealthAdvisories(reading),
    generateForecast(reading, historical),
    generateCommunityInsights(reading),
  ]);

  // Health Advisory
  if (advisoriesResult.status === 'fulfilled') {
    updateAgentStatus('HealthAdvisoryAgent', 'success', update, Date.now() - phase2Start);
    update(() => ({ advisories: advisoriesResult.value }));

    const criticalAdvisories = advisoriesResult.value.filter((a) => a.riskLevel === 'Critical' || a.riskLevel === 'High');
    if (criticalAdvisories.length > 0) {
      addNotification(
        {
          id: `health-${Date.now()}`,
          type: 'alert',
          title: 'Health Advisory Issued',
          message: `${criticalAdvisories[0].riskGroup}: ${criticalAdvisories[0].recommendation}`,
          timestamp: new Date().toISOString(),
          read: false,
          agentSource: 'HealthAdvisoryAgent',
        },
        update,
        get,
      );
    }
  } else {
    updateAgentStatus('HealthAdvisoryAgent', 'error', update, undefined, String(advisoriesResult.reason));
  }

  // Forecast
  if (forecastResult.status === 'fulfilled') {
    updateAgentStatus('ForecastingAgent', 'success', update, Date.now() - phase2Start);
    update(() => ({ forecast: forecastResult.value }));

    // Add forecast alert notifications
    for (const alert of forecastResult.value.alerts.filter((a) => a.severity !== 'info')) {
      addNotification(
        {
          id: `forecast-${alert.id}-${Date.now()}`,
          type: alert.severity === 'critical' ? 'alert' : 'warning',
          title: 'Forecast Alert',
          message: alert.message,
          timestamp: new Date().toISOString(),
          read: false,
          agentSource: 'ForecastingAgent',
        },
        update,
        get,
      );
    }
  } else {
    updateAgentStatus('ForecastingAgent', 'error', update, undefined, String(forecastResult.reason));
  }

  // Community
  if (communityResult.status === 'fulfilled') {
    updateAgentStatus('CommunityActionAgent', 'success', update, Date.now() - phase2Start);
    update(() => ({ communityInsights: communityResult.value }));
  } else {
    updateAgentStatus('CommunityActionAgent', 'error', update, undefined, String(communityResult.reason));
  }

  update(() => ({
    isLoading: false,
    lastRefresh: new Date().toISOString(),
  }));

  // Store stations in a custom field (extend store later)
  (window as Window & { __aqStations?: MapStation[] }).__aqStations = stations;
}

function updateAgentStatus(
  name: AgentName,
  status: AgentStatus['status'],
  update: StateUpdater,
  latency?: number,
  error?: string,
): void {
  update((state) => {
    const agents = [...(state.agents ?? [])];
    const idx = agents.findIndex((a) => a.name === name);
    const updated: AgentStatus = {
      name,
      status,
      lastRun: new Date().toISOString(),
      latency,
      error,
    };
    if (idx >= 0) agents[idx] = updated;
    else agents.push(updated);
    return { agents };
  });
}

function addNotification(
  notification: Notification,
  update: StateUpdater,
  get: StateGetter,
): void {
  const existing = get().notifications ?? [];
  // Avoid duplicate notifications in same session
  const isDupe = existing.some(
    (n) => n.agentSource === notification.agentSource && n.title === notification.title,
  );
  if (!isDupe) {
    update((state) => ({
      notifications: [notification, ...(state.notifications ?? [])].slice(0, 20),
    }));
  }
}

/** Build initial agent status array */
export function buildInitialAgentStatuses(): AgentStatus[] {
  const names: AgentName[] = ['AQIDataAgent', 'HealthAdvisoryAgent', 'ForecastingAgent', 'CommunityActionAgent'];
  return names.map((name) => ({ name, status: 'idle' }));
}
