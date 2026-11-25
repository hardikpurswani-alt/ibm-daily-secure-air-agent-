import type {
  AlertItem,
  AuthUser,
  ChatResponse,
  ChatSessionSummary,
  CommunityInsightResponse,
  HealthAdvisoryResponse,
  HealthProfileInput,
  LocationSuggestion,
  PreferencesPayload,
  RAGCitation,
  SystemStatus,
  UnifiedBriefingResponse,
} from '../types/airguard'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const TOKEN_KEY = 'airguard_auth_token'
const SESSION_KEY = 'airguard_session_id'

function getSessionId(): string {
  try {
    let sid = localStorage.getItem(SESSION_KEY)
    if (!sid) {
      sid = crypto.randomUUID ? crypto.randomUUID() : `ag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      localStorage.setItem(SESSION_KEY, sid)
    }
    return sid
  } catch {
    return 'browser-session'
  }
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore storage restriction
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  headers.set('X-Session-ID', getSessionId())
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getAuthToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })
  const text = await res.text()
  const payload = text ? JSON.parse(text) : {}
  if (!res.ok) {
    const msg = payload.error || payload.detail || `Request failed (HTTP ${res.status})`
    throw new Error(msg)
  }
  return payload as T
}

export const apiClient = {
  getBriefing(city: string, lat?: number, lon?: number) {
    const params = new URLSearchParams({ city })
    if (lat !== undefined && lon !== undefined) {
      params.set('lat', String(lat))
      params.set('lon', String(lon))
    }
    return request<UnifiedBriefingResponse>(`/api/v1/agents/briefing?${params.toString()}`)
  },

  searchLocations(q: string) {
    return request<LocationSuggestion[]>(`/api/v1/aqi/search-locations?q=${encodeURIComponent(q)}&count=6`)
  },

  runHealthAdvisory(city: string, profile: HealthProfileInput) {
    return request<HealthAdvisoryResponse>(`/api/v1/agents/health-advisory?city=${encodeURIComponent(city)}`, {
      method: 'POST',
      body: JSON.stringify(profile),
    })
  },

  getCommunity(city: string) {
    return request<CommunityInsightResponse>(`/api/v1/agents/community?city=${encodeURIComponent(city)}`)
  },

  togglePledge(actionId: string, city: string, note?: string) {
    return request<{ action_id: string; user_pledged: boolean; pledge_count: number }>('/api/v1/agents/community/pledges', {
      method: 'POST',
      body: JSON.stringify({ action_id: actionId, city, note }),
    })
  },

  submitPollutionReport(payload: {
    city: string
    category: 'open_burning' | 'construction_dust' | 'traffic_congestion' | 'industrial_smoke' | 'other'
    description: string
    latitude?: number
    longitude?: number
  }) {
    return request<{ id: string; city: string; category: string; description: string; created_at: string }>(
      '/api/v1/agents/community/reports',
      { method: 'POST', body: JSON.stringify(payload) },
    )
  },

  sendChat(payload: { message: string; city: string; session_id?: string | null; health_profile?: HealthProfileInput }) {
    return request<ChatResponse>('/api/v1/orchestrate/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  listSessions() {
    return request<ChatSessionSummary[]>('/api/v1/orchestrate/sessions')
  },

  getSessionMessages(sessionId: string) {
    return request<{
      session_id: string
      city: string
      title: string
      messages: Array<{
        id: string
        role: 'user' | 'assistant'
        content: string
        trace: UnifiedBriefingResponse['agent_trace']
        citations: RAGCitation[]
        coordinator_mode?: string
        created_at: string
      }>
    }>(`/api/v1/orchestrate/sessions/${encodeURIComponent(sessionId)}`)
  },

  getAlerts() {
    return request<AlertItem[]>('/api/v1/alerts')
  },

  markAlertRead(alertId: string) {
    return request<{ id: string; read: boolean }>(`/api/v1/alerts/${encodeURIComponent(alertId)}/read`, {
      method: 'POST',
    })
  },

  markAllAlertsRead() {
    return request<{ updated: boolean }>('/api/v1/alerts/mark-all-read', { method: 'POST' })
  },

  dismissAlert(alertId: string) {
    return request<{ id: string; dismissed: boolean }>(`/api/v1/alerts/${encodeURIComponent(alertId)}`, {
      method: 'DELETE',
    })
  },

  getPreferences() {
    return request<PreferencesPayload>('/api/v1/preferences')
  },

  updatePreferences(payload: PreferencesPayload) {
    return request<PreferencesPayload>('/api/v1/preferences', {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  clearHealthPreferences() {
    return request<PreferencesPayload>('/api/v1/preferences/health', { method: 'DELETE' })
  },

  revokeLocationConsent() {
    return request<PreferencesPayload>('/api/v1/preferences/location-consent', { method: 'DELETE' })
  },

  searchRag(q: string) {
    return request<{ query: string; citations: RAGCitation[] }>(`/api/v1/rag/search?q=${encodeURIComponent(q)}&top_k=4`)
  },

  getSystemStatus() {
    return request<SystemStatus>('/api/v1/system/status')
  },

  register(email: string, full_name: string, password: string) {
    return request<{ access_token: string; user: AuthUser }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, full_name, password }),
    })
  },

  login(email: string, password: string) {
    return request<{ access_token: string; user: AuthUser }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },

  me() {
    return request<{ authenticated: boolean; user: AuthUser | null }>('/api/v1/auth/me')
  },
}
