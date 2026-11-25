import { useEffect } from 'react'
import { MotionConfig } from 'framer-motion'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { AppShell } from './components/AppShell'
import { AlertsPage } from './pages/AlertsPage'
import { AssistantPage } from './pages/AssistantPage'
import { CommunityPage } from './pages/CommunityPage'
import { DashboardPage } from './pages/DashboardPage'
import { ForecastPage } from './pages/ForecastPage'
import { HealthAdvisoryPage } from './pages/HealthAdvisoryPage'
import { HistoricalAnalyticsPage } from './pages/HistoricalAnalyticsPage'
import { LiveMonitoringPage } from './pages/LiveMonitoringPage'
import { PollutionMapPage } from './pages/PollutionMapPage'
import { SettingsPage } from './pages/SettingsPage'
import { useAirGuardStore } from './store/useAirGuardStore'

export function App() {
  const { activePage, initApp, briefing, isLoading, error, refreshBriefing } = useAirGuardStore()

  useEffect(() => {
    void initApp()
  }, [initApp])

  const renderPage = () => {
    if (error && !briefing) {
      return (
        <div role="alert" className="ag-glass rounded-3xl p-8 max-w-xl mx-auto text-center space-y-4 mt-8">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" aria-hidden="true" />
          <h2 className="text-lg font-bold">Unable to Retrieve Live Telemetry</h2>
          <p className="text-sm text-[var(--ag-muted)]">{error}</p>
          <button
            type="button"
            onClick={() => void refreshBriefing()}
            className="min-h-[42px] px-5 py-2 rounded-full bg-[var(--ag-accent)] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Retry Live Sync
          </button>
        </div>
      )
    }

    if (isLoading && !briefing && activePage !== 'settings' && activePage !== 'assistant') {
      return (
        <div className="space-y-5" aria-busy="true" aria-label="Loading live air quality briefing">
          <div className="h-10 w-72 rounded-2xl ag-glass animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 h-72 rounded-3xl ag-glass animate-pulse" />
            <div className="lg:col-span-7 h-72 rounded-3xl ag-glass animate-pulse" />
          </div>
          <div className="h-44 rounded-3xl ag-glass animate-pulse" />
        </div>
      )
    }

    switch (activePage) {
      case 'dashboard':
        return <DashboardPage />
      case 'live':
        return <LiveMonitoringPage />
      case 'map':
        return <PollutionMapPage />
      case 'historical':
        return <HistoricalAnalyticsPage />
      case 'forecast':
        return <ForecastPage />
      case 'health':
        return <HealthAdvisoryPage />
      case 'alerts':
        return <AlertsPage />
      case 'community':
        return <CommunityPage />
      case 'assistant':
        return <AssistantPage />
      case 'settings':
        return <SettingsPage />
      default:
        return <DashboardPage />
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <AppShell>
        {error && briefing ? (
          <div role="alert" className="mb-4 rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-xs flex items-center justify-between gap-2">
            <span>{error}</span>
            <button type="button" onClick={() => void refreshBriefing()} className="font-semibold underline cursor-pointer">
              Retry
            </button>
          </div>
        ) : null}
        {renderPage()}
      </AppShell>
    </MotionConfig>
  )
}

export default App
