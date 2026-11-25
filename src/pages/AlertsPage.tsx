import { useState } from 'react'
import { AlertTriangle, Bell, CheckCheck, Info, Trash2 } from 'lucide-react'
import { formatTimestamp } from '../lib/aqiTheme'
import { useAirGuardStore } from '../store/useAirGuardStore'

export function AlertsPage() {
  const { alerts, markAlertRead, markAllAlertsRead, dismissAlert, preferences } = useAirGuardStore()
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical' | 'warning'>('all')

  const filtered = alerts.filter((a) => {
    if (filter === 'unread') return !a.read
    if (filter === 'critical') return a.severity === 'critical'
    if (filter === 'warning') return a.severity === 'warning'
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Predictive Alerts & Notifications</h2>
          <p className="text-sm text-[var(--ag-muted)]">
            Active threshold: AQI &gt;= <strong className="text-[var(--ag-text)]">{preferences.alert_aqi_threshold}</strong> ·
            Persisted in database across sessions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void markAllAlertsRead()}
          className="min-h-[42px] px-4 py-2 rounded-full border border-[var(--ag-border)] text-xs font-semibold inline-flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
        >
          <CheckCheck className="w-4 h-4 text-[var(--ag-emerald)]" aria-hidden="true" />
          Mark All Read
        </button>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter alerts">
        {(['all', 'unread', 'critical', 'warning'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border capitalize cursor-pointer ${
              filter === f
                ? 'bg-[var(--ag-accent)] text-white border-transparent'
                : 'border-[var(--ag-border)] text-[var(--ag-muted)]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="ag-glass rounded-3xl p-10 text-center text-sm text-[var(--ag-muted)]">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" aria-hidden="true" />
            No notifications match this filter.
          </div>
        ) : (
          filtered.map((a) => {
            const isCrit = a.severity === 'critical'
            const isWarn = a.severity === 'warning'
            return (
              <article
                key={a.id}
                className={`ag-glass rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border ${
                  !a.read ? 'border-[var(--ag-accent)]/50' : 'border-[var(--ag-border)]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isCrit ? 'bg-rose-500/15 text-rose-500' : isWarn ? 'bg-amber-500/15 text-amber-500' : 'bg-sky-500/15 text-sky-500'
                    }`}
                  >
                    {isCrit || isWarn ? <AlertTriangle className="w-4 h-4" aria-hidden="true" /> : <Info className="w-4 h-4" aria-hidden="true" />}
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-sm">{a.title}</h3>
                      {!a.read ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--ag-accent)] text-white">
                          New
                        </span>
                      ) : null}
                      <span className="text-[11px] text-[var(--ag-muted)]">
                        {a.agent_source} · Window: {a.time_window}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--ag-muted)] leading-relaxed">{a.message}</p>
                    <div className="text-[11px] text-[var(--ag-muted)]">{formatTimestamp(a.created_at)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!a.read ? (
                    <button
                      type="button"
                      onClick={() => void markAlertRead(a.id)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[var(--ag-border)] text-xs font-medium cursor-pointer"
                    >
                      Mark Read
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void dismissAlert(a.id)}
                    aria-label={`Dismiss alert: ${a.title}`}
                    className="min-w-[38px] min-h-[38px] rounded-xl border border-[var(--ag-border)] flex items-center justify-center text-[var(--ag-muted)] hover:text-rose-500 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </article>
            )
          })
        )}
      </div>
    </div>
  )
}
