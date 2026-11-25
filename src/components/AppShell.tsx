import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  Bell,
  Bot,
  CalendarClock,
  HeartPulse,
  LayoutDashboard,
  Map as MapIcon,
  Menu,
  Navigation,
  RefreshCw,
  Search,
  Settings,
  TrendingUp,
  Users,
  Wind,
  X,
} from 'lucide-react'
import { apiClient } from '../services/apiClient'
import { useAirGuardStore } from '../store/useAirGuardStore'
import type { LocationSuggestion, PageId } from '../types/airguard'

interface NavItem {
  id: PageId
  label: string
  Icon: typeof LayoutDashboard
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'live', label: 'Live Monitoring', Icon: Activity },
  { id: 'map', label: 'Pollution Map', Icon: MapIcon },
  { id: 'historical', label: 'Historical Analytics', Icon: TrendingUp },
  { id: 'forecast', label: 'Forecasts', Icon: CalendarClock },
  { id: 'health', label: 'Health Advisory', Icon: HeartPulse },
  { id: 'alerts', label: 'Alerts', Icon: Bell },
  { id: 'community', label: 'Community Action', Icon: Users },
  { id: 'assistant', label: 'AI Chat Assistant', Icon: Bot },
  { id: 'settings', label: 'Settings', Icon: Settings },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    activePage,
    setActivePage,
    selectedCity,
    selectCity,
    refreshBriefing,
    isLoading,
    alerts,
    preferences,
    briefing,
    locationConsentDialogOpen,
    setLocationConsentDialogOpen,
    grantConsentAndLocate,
  } = useAirGuardStore()

  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const consentDialogRef = useRef<HTMLDialogElement>(null)

  const unreadAlerts = alerts.filter((a) => !a.read).length

  useEffect(() => {
    const dlg = consentDialogRef.current
    if (!dlg) return
    if (locationConsentDialogOpen && !dlg.open) dlg.showModal()
    else if (!locationConsentDialogOpen && dlg.open) dlg.close()
  }, [locationConsentDialogOpen])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) return
    const timer = setTimeout(async () => {
      try {
        const res = await apiClient.searchLocations(trimmed)
        setSuggestions(res)
      } catch {
        setSuggestions([])
      }
    }, 260)
    return () => clearTimeout(timer)
  }, [query])

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setShowDropdown(false)
    await selectCity(query.trim())
    setQuery('')
  }

  const handleUseMyLocation = () => {
    if (preferences.location_consent_granted) {
      void grantConsentAndLocate()
    } else {
      setLocationConsentDialogOpen(true)
    }
  }

  const savedCities = Array.from(new Set([selectedCity, ...(preferences.saved_cities || [])])).slice(0, 4)

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row">
      <a href="#main-content" className="visually-hidden focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-xl focus:bg-[var(--ag-accent)] focus:text-white">
        Skip to main content
      </a>

      {/* Desktop Left Navigation Rail */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:sticky lg:top-0 lg:h-dvh p-4 border-r border-[var(--ag-border)] ag-glass">
        <div className="flex items-center gap-3 px-2 pb-5 border-b border-[var(--ag-border)]">
          <div className="w-10 h-10 rounded-2xl bg-[var(--ag-accent)] text-white flex items-center justify-center shadow-md">
            <Wind className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight leading-tight">AirGuard AI</h1>
            <p className="text-[11px] text-[var(--ag-muted)]">watsonx Orchestrate</p>
          </div>
        </div>

        <nav aria-label="Primary" className="mt-4 flex-1 overflow-y-auto space-y-1">
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const active = activePage === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActivePage(id)}
                aria-current={active ? 'page' : undefined}
                className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                  active
                    ? 'bg-[var(--ag-accent)] text-white shadow-sm'
                    : 'text-[var(--ag-muted)] hover:text-[var(--ag-text)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                </span>
                {id === 'alerts' && unreadAlerts > 0 ? (
                  <span
                    className={`px-2 py-0.5 text-[11px] font-bold rounded-full tabular-nums ${
                      active ? 'bg-white/20 text-white' : 'bg-red-500/15 text-red-500'
                    }`}
                  >
                    {unreadAlerts}
                  </span>
                ) : null}
              </button>
            )
          })}
        </nav>

        <div className="mt-4 pt-3 border-t border-[var(--ag-border)] text-[11px] text-[var(--ag-muted)] space-y-1 px-2">
          <div className="font-semibold text-[var(--ag-text)]">Coordinator Agent</div>
          <div className="truncate font-mono text-[10px]">9804aee5-5298-40dc...</div>
          <div>
            Mode:{' '}
            <span className="font-semibold text-[var(--ag-emerald)]">
              {briefing?.orchestration_mode === 'watsonx_orchestrate_live'
                ? 'Live Orchestrate'
                : briefing?.orchestration_mode === 'local_coordinator_with_granite'
                  ? 'Granite + Local'
                  : 'Local Multi-Agent'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 ag-glass border-b border-[var(--ag-border)] px-4 lg:px-7 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-nav-drawer"
                aria-label="Toggle navigation menu"
                className="min-w-[44px] min-h-[44px] rounded-xl border border-[var(--ag-border)] flex items-center justify-center cursor-pointer"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
              </button>
              <div className="flex items-center gap-2">
                <Wind className="w-5 h-5 text-[var(--ag-accent)]" aria-hidden="true" />
                <span className="font-bold text-sm">AirGuard AI</span>
              </div>
            </div>

            {/* Search Location Form */}
            <search className="relative flex-1 min-w-[220px] max-w-md">
              <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                <label htmlFor="city-search-input" className="visually-hidden">
                  Search city for live air quality
                </label>
                <Search className="w-4 h-4 text-[var(--ag-muted)] absolute left-3.5 pointer-events-none" aria-hidden="true" />
                <input
                  id="city-search-input"
                  type="search"
                  value={query}
                  onChange={(e) => {
                    const nextVal = e.target.value
                    setQuery(nextVal)
                    if (nextVal.trim().length < 2) setSuggestions([])
                    setShowDropdown(true)
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder={`Search city (active: ${selectedCity})...`}
                  className="w-full min-h-[42px] pl-10 pr-20 rounded-full border border-[var(--ag-border)] bg-[var(--ag-surface-elevated)] text-sm text-[var(--ag-text)] placeholder:text-[var(--ag-muted)]"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 px-3 py-1 rounded-full bg-[var(--ag-accent)] text-white text-xs font-semibold cursor-pointer"
                >
                  Check
                </button>
              </form>

              {showDropdown && suggestions.length > 0 ? (
                <ul
                  role="listbox"
                  aria-label="Matching cities"
                  className="absolute left-0 right-0 mt-1.5 rounded-2xl ag-glass-strong border border-[var(--ag-border)] overflow-hidden z-40 shadow-xl"
                >
                  {suggestions.map((loc) => (
                    <li key={`${loc.name}-${loc.latitude}-${loc.longitude}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDropdown(false)
                          setQuery('')
                          void selectCity(loc.name, loc.latitude, loc.longitude)
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 flex justify-between items-center cursor-pointer"
                      >
                        <span className="font-medium">{loc.name}</span>
                        <span className="text-xs text-[var(--ag-muted)]">
                          {[loc.region, loc.country].filter(Boolean).join(', ')}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </search>

            {/* Quick Cities & Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="hidden xl:flex items-center gap-1.5">
                {savedCities.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => void selectCity(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition cursor-pointer ${
                      c.toLowerCase() === selectedCity.toLowerCase()
                        ? 'bg-[var(--ag-accent)] text-white border-transparent'
                        : 'border-[var(--ag-border)] text-[var(--ag-muted)] hover:text-[var(--ag-text)]'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleUseMyLocation}
                className="min-h-[40px] px-3 py-1.5 rounded-full border border-[var(--ag-border)] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                title="Locate nearby air quality stations"
              >
                <Navigation className="w-3.5 h-3.5 text-[var(--ag-accent)]" aria-hidden="true" />
                <span className="hidden sm:inline">My Location</span>
              </button>

              <button
                type="button"
                onClick={() => void refreshBriefing()}
                disabled={isLoading}
                className="min-h-[40px] px-3 py-1.5 rounded-full border border-[var(--ag-border)] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50 cursor-pointer"
                aria-label="Refresh live air quality briefing"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
                <span className="hidden sm:inline">{isLoading ? 'Syncing...' : 'Refresh'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePage('alerts')}
                className="relative min-w-[40px] min-h-[40px] rounded-full border border-[var(--ag-border)] flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                aria-label={`View notifications (${unreadAlerts} unread)`}
              >
                <Bell className="w-4 h-4" aria-hidden="true" />
                {unreadAlerts > 0 ? (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {unreadAlerts}
                  </span>
                ) : null}
              </button>
            </div>
          </div>

          {/* Mobile Drawer Navigation */}
          {mobileMenuOpen ? (
            <nav id="mobile-nav-drawer" aria-label="Mobile Primary" className="lg:hidden mt-3 pt-3 border-t border-[var(--ag-border)] grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {NAV_ITEMS.map(({ id, label, Icon }) => {
                const active = activePage === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setActivePage(id)
                      setMobileMenuOpen(false)
                    }}
                    aria-current={active ? 'page' : undefined}
                    className={`min-h-[44px] flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer ${
                      active ? 'bg-[var(--ag-accent)] text-white' : 'bg-[var(--ag-surface-elevated)] text-[var(--ag-text)]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{label}</span>
                  </button>
                )
              })}
            </nav>
          ) : null}
        </header>

        {/* Main View */}
        <main id="main-content" className="flex-1 p-4 lg:p-7 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Native Modal Dialog Asking Explicit Permission Before Using Browser Geolocation */}
      <dialog
        ref={consentDialogRef}
        aria-labelledby="geo-consent-title"
        onCancel={(e) => {
          e.preventDefault()
          setLocationConsentDialogOpen(false)
        }}
        className="m-auto max-w-md w-[calc(100%-2rem)] rounded-3xl ag-glass-strong p-6 text-[var(--ag-text)] border border-[var(--ag-border)] shadow-2xl"
      >
        <h1 id="geo-consent-title" className="text-lg font-bold">
          Permission to Use Your Location
        </h1>
        <p className="mt-2 text-sm text-[var(--ag-muted)] leading-relaxed">
          AirGuard AI requests your browser coordinates strictly to look up nearby monitoring stations and regional
          forecasts. You can revoke location consent at any time in Settings.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            autoFocus
            onClick={() => setLocationConsentDialogOpen(false)}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-[var(--ag-border)] text-sm font-medium cursor-pointer"
          >
            Not Now
          </button>
          <button
            type="button"
            onClick={() => void grantConsentAndLocate()}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--ag-accent)] text-white text-sm font-semibold cursor-pointer"
          >
            Allow Location Lookup
          </button>
        </div>
      </dialog>
    </div>
  )
}
