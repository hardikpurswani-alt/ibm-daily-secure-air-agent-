import { create } from 'zustand'
import { apiClient, setAuthToken } from '../services/apiClient'
import type {
  AlertItem,
  AuthUser,
  ChatMessageItem,
  ChatSessionSummary,
  HealthProfileInput,
  PageId,
  PreferencesPayload,
  SystemStatus,
  UnifiedBriefingResponse,
} from '../types/airguard'

interface AirGuardStore {
  activePage: PageId
  selectedCity: string
  coords: { lat: number; lon: number } | null
  briefing: UnifiedBriefingResponse | null
  alerts: AlertItem[]
  preferences: PreferencesPayload
  systemStatus: SystemStatus | null
  authUser: AuthUser | null
  chatSessions: ChatSessionSummary[]
  activeSessionId: string | null
  chatMessages: ChatMessageItem[]
  isLoading: boolean
  isChatLoading: boolean
  error: string | null
  locationConsentDialogOpen: boolean

  setActivePage: (page: PageId) => void
  setLocationConsentDialogOpen: (open: boolean) => void
  initApp: () => Promise<void>
  selectCity: (city: string, lat?: number, lon?: number) => Promise<void>
  refreshBriefing: () => Promise<void>
  refreshAlerts: () => Promise<void>
  refreshStatus: () => Promise<void>
  updateHealthAdvisory: (profile: HealthProfileInput) => Promise<void>
  savePreferences: (next: PreferencesPayload) => Promise<void>
  clearHealthPreferences: () => Promise<void>
  revokeLocationConsent: () => Promise<void>
  applyThemePreference: (theme: 'system' | 'light' | 'dark') => void
  grantConsentAndLocate: () => Promise<void>
  togglePledge: (actionId: string) => Promise<void>
  submitPollutionReport: (payload: {
    category: 'open_burning' | 'construction_dust' | 'traffic_congestion' | 'industrial_smoke' | 'other'
    description: string
  }) => Promise<void>
  sendChatMessage: (message: string) => Promise<void>
  loadChatSession: (sessionId: string) => Promise<void>
  startNewChatSession: () => void
  markAlertRead: (id: string) => Promise<void>
  markAllAlertsRead: () => Promise<void>
  dismissAlert: (id: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (email: string, fullName: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const DEFAULT_PREFS: PreferencesPayload = {
  default_city: 'Delhi',
  saved_cities: ['Delhi', 'Sydney', 'New York'],
  aqi_standard: 'us_epa',
  theme_preference: 'system',
  alert_aqi_threshold: 100,
  notifications_enabled: true,
  location_consent_granted: false,
  age_group: 'adult',
  outdoor_activity: 'moderate',
  health_considerations: [],
}

function applyColorSchemeMeta(theme: 'system' | 'light' | 'dark') {
  const meta = document.querySelector('meta[name="color-scheme"]')
  const value = theme === 'system' ? 'light dark' : theme
  if (meta) {
    meta.setAttribute('content', value)
  }
  try {
    if (theme === 'system') localStorage.removeItem('airguard_theme')
    else localStorage.setItem('airguard_theme', theme)
  } catch {
    // ignore
  }
}

export const useAirGuardStore = create<AirGuardStore>((set, get) => ({
  activePage: 'dashboard',
  selectedCity: 'Delhi',
  coords: null,
  briefing: null,
  alerts: [],
  preferences: DEFAULT_PREFS,
  systemStatus: null,
  authUser: null,
  chatSessions: [],
  activeSessionId: null,
  chatMessages: [],
  isLoading: false,
  isChatLoading: false,
  error: null,
  locationConsentDialogOpen: false,

  setActivePage: (page) => set({ activePage: page }),
  setLocationConsentDialogOpen: (open) => set({ locationConsentDialogOpen: open }),

  applyThemePreference: (theme) => {
    applyColorSchemeMeta(theme)
    set((s) => ({ preferences: { ...s.preferences, theme_preference: theme } }))
  },

  initApp: async () => {
    set({ isLoading: true, error: null })
    try {
      const [meRes, prefs, sessions, status] = await Promise.all([
        apiClient.me().catch(() => ({ authenticated: false, user: null })),
        apiClient.getPreferences().catch(() => DEFAULT_PREFS),
        apiClient.listSessions().catch(() => []),
        apiClient.getSystemStatus().catch(() => null),
      ])
      applyColorSchemeMeta(prefs.theme_preference)
      const city = prefs.default_city || 'Delhi'
      set({
        authUser: meRes.user,
        preferences: prefs,
        selectedCity: city,
        chatSessions: sessions,
        systemStatus: status,
      })

      const [briefing, alerts] = await Promise.all([
        apiClient.getBriefing(city),
        apiClient.getAlerts().catch(() => []),
      ])
      set({ briefing, alerts, isLoading: false })
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Unable to load air quality data.',
      })
    }
  },

  selectCity: async (city, lat, lon) => {
    set({
      selectedCity: city,
      coords: lat !== undefined && lon !== undefined ? { lat, lon } : null,
      isLoading: true,
      error: null,
    })
    try {
      const [briefing, alerts] = await Promise.all([
        apiClient.getBriefing(city, lat, lon),
        apiClient.getAlerts().catch(() => get().alerts),
      ])
      set({ briefing, alerts, isLoading: false, selectedCity: briefing.city })
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch live telemetry for this location.',
      })
    }
  },

  refreshBriefing: async () => {
    const { selectedCity, coords } = get()
    await get().selectCity(selectedCity, coords?.lat, coords?.lon)
  },

  refreshAlerts: async () => {
    const alerts = await apiClient.getAlerts().catch(() => get().alerts)
    set({ alerts })
  },

  refreshStatus: async () => {
    const systemStatus = await apiClient.getSystemStatus().catch(() => null)
    if (systemStatus) set({ systemStatus })
  },

  updateHealthAdvisory: async (profile) => {
    const { selectedCity, briefing } = get()
    const advisory = await apiClient.runHealthAdvisory(selectedCity, profile)
    if (briefing) {
      set({ briefing: { ...briefing, health_advisory: advisory } })
    }
  },

  savePreferences: async (next) => {
    applyColorSchemeMeta(next.theme_preference)
    const saved = await apiClient.updatePreferences(next)
    set({ preferences: saved })
  },

  clearHealthPreferences: async () => {
    const saved = await apiClient.clearHealthPreferences()
    set({ preferences: saved })
    await get().refreshBriefing()
  },

  revokeLocationConsent: async () => {
    const saved = await apiClient.revokeLocationConsent()
    set({ preferences: saved, coords: null })
  },

  grantConsentAndLocate: async () => {
    const prefs = get().preferences
    const updated = await apiClient.updatePreferences({ ...prefs, location_consent_granted: true })
    set({ preferences: updated, locationConsentDialogOpen: false })

    if (!navigator.geolocation) {
      set({ error: 'Browser geolocation is not supported in this environment.' })
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(4))
        const lon = Number(pos.coords.longitude.toFixed(4))
        await get().selectCity(`My Location (${lat.toFixed(2)}, ${lon.toFixed(2)})`, lat, lon)
      },
      (geoErr) => {
        set({ error: `Location access denied or unavailable: ${geoErr.message}` })
      },
      { enableHighAccuracy: false, timeout: 10000 },
    )
  },

  togglePledge: async (actionId) => {
    const { selectedCity, briefing } = get()
    const res = await apiClient.togglePledge(actionId, selectedCity)
    if (briefing) {
      const updatedActions = briefing.community.actions.map((a) =>
        a.id === actionId ? { ...a, pledge_count: res.pledge_count, user_pledged: res.user_pledged } : a,
      )
      set({
        briefing: {
          ...briefing,
          community: { ...briefing.community, actions: updatedActions },
        },
      })
    }
  },

  submitPollutionReport: async ({ category, description }) => {
    const { selectedCity, coords, briefing } = get()
    await apiClient.submitPollutionReport({
      city: selectedCity,
      category,
      description,
      latitude: coords?.lat ?? briefing?.live_aqi.location.latitude,
      longitude: coords?.lon ?? briefing?.live_aqi.location.longitude,
    })
    const community = await apiClient.getCommunity(selectedCity)
    if (briefing) {
      set({ briefing: { ...briefing, community } })
    }
  },

  sendChatMessage: async (message) => {
    const { selectedCity, activeSessionId, preferences, chatMessages } = get()
    const optimisticUser: ChatMessageItem = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: message,
      trace: [],
      citations: [],
      created_at: new Date().toISOString(),
    }
    set({ chatMessages: [...chatMessages, optimisticUser], isChatLoading: true, error: null })
    try {
      const res = await apiClient.sendChat({
        message,
        city: selectedCity,
        session_id: activeSessionId,
        health_profile: {
          age_group: preferences.age_group || 'adult',
          outdoor_activity: preferences.outdoor_activity || 'moderate',
          health_considerations: preferences.health_considerations,
        },
      })
      const assistantMsg: ChatMessageItem = {
        id: res.message_id,
        role: 'assistant',
        content: res.reply,
        trace: res.agent_trace,
        citations: res.citations,
        coordinator_mode: res.orchestration_mode,
        created_at: res.timestamp,
      }
      const sessions = await apiClient.listSessions().catch(() => get().chatSessions)
      set((s) => ({
        activeSessionId: res.session_id,
        chatMessages: [...s.chatMessages, assistantMsg],
        chatSessions: sessions,
        isChatLoading: false,
      }))
    } catch (err) {
      set({
        isChatLoading: false,
        error: err instanceof Error ? err.message : 'Assistant failed to respond.',
      })
    }
  },

  loadChatSession: async (sessionId) => {
    set({ isChatLoading: true })
    try {
      const data = await apiClient.getSessionMessages(sessionId)
      set({
        activeSessionId: data.session_id,
        chatMessages: data.messages,
        isChatLoading: false,
      })
    } catch {
      set({ isChatLoading: false })
    }
  },

  startNewChatSession: () => set({ activeSessionId: null, chatMessages: [] }),

  markAlertRead: async (id) => {
    await apiClient.markAlertRead(id)
    set((s) => ({ alerts: s.alerts.map((a) => (a.id === id ? { ...a, read: true } : a)) }))
  },

  markAllAlertsRead: async () => {
    await apiClient.markAllAlertsRead()
    set((s) => ({ alerts: s.alerts.map((a) => ({ ...a, read: true })) }))
  },

  dismissAlert: async (id) => {
    await apiClient.dismissAlert(id)
    set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) }))
  },

  login: async (email, password) => {
    const res = await apiClient.login(email, password)
    setAuthToken(res.access_token)
    set({ authUser: res.user })
    await get().initApp()
  },

  register: async (email, fullName, password) => {
    const res = await apiClient.register(email, fullName, password)
    setAuthToken(res.access_token)
    set({ authUser: res.user })
    await get().initApp()
  },

  logout: async () => {
    setAuthToken(null)
    set({ authUser: null, activeSessionId: null, chatMessages: [] })
    await get().initApp()
  },
}))
