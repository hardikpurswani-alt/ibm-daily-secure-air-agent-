import { useState } from 'react'
import { Bot, Check, ExternalLink, Flag, Landmark, Users } from 'lucide-react'
import { CitationsDrawer } from '../components/CitationsDrawer'
import { formatTimestamp } from '../lib/aqiTheme'
import { useAirGuardStore } from '../store/useAirGuardStore'

export function CommunityPage() {
  const { briefing, togglePledge, submitPollutionReport } = useAirGuardStore()
  const [catFilter, setCatFilter] = useState<string>('all')
  const [reportCategory, setReportCategory] = useState<
    'open_burning' | 'construction_dust' | 'traffic_congestion' | 'industrial_smoke' | 'other'
  >('construction_dust')
  const [reportDesc, setReportDesc] = useState('')
  const [reportStatus, setReportStatus] = useState('')

  if (!briefing) return null
  const { community } = briefing

  const filteredActions = community.actions.filter((a) => catFilter === 'all' || a.category === catFilter)

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (reportDesc.trim().length < 5) {
      setReportStatus('Please enter at least 5 characters describing the observation.')
      return
    }
    await submitPollutionReport({ category: reportCategory, description: reportDesc.trim() })
    setReportDesc('')
    setReportStatus('Citizen report logged in the community database.')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Community Action & Policy Awareness</h2>
        <p className="text-sm text-[var(--ag-muted)]">{community.campaign_headline}</p>
      </div>

      {/* Overview Stats + Granite Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-7 ag-glass rounded-3xl p-6 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--ag-accent)] flex items-center gap-1.5">
            <Bot className="w-4 h-4" aria-hidden="true" />
            Community Action Agent ({community.reasoning_mode === 'ibm_watsonx_granite' ? 'IBM Granite' : 'Evidence Synthesis'})
          </div>
          <p className="text-sm leading-relaxed">{community.granite_analysis}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
            <div className="rounded-2xl border border-[var(--ag-border)] p-3.5">
              <div className="text-[var(--ag-muted)]">Probable Dominant Driver</div>
              <div className="mt-1 font-semibold">{community.dominant_source_hypothesis}</div>
            </div>
            <div className="rounded-2xl border border-[var(--ag-border)] p-3.5">
              <div className="text-[var(--ag-muted)]">Verified Local Citizen Reports</div>
              <div className="mt-1 text-xl font-bold tabular-nums">{community.local_report_count}</div>
            </div>
          </div>
        </section>

        {/* Citizen Pollution Observation Form */}
        <form onSubmit={handleReportSubmit} className="lg:col-span-5 ag-glass rounded-3xl p-6 space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-1.5">
            <Flag className="w-4 h-4 text-amber-500" aria-hidden="true" />
            Log Local Pollution Observation ({community.location})
          </h3>
          <div>
            <label htmlFor="report-cat" className="block text-xs font-medium text-[var(--ag-muted)] mb-1">
              Observation Category
            </label>
            <select
              id="report-cat"
              value={reportCategory}
              onChange={(e) => setReportCategory(e.target.value as typeof reportCategory)}
              className="w-full min-h-[42px] px-3 rounded-xl border border-[var(--ag-border)] bg-[var(--ag-surface-elevated)] text-sm"
            >
              <option value="construction_dust">Uncovered Construction Dust</option>
              <option value="open_burning">Open Waste / Leaf Burning</option>
              <option value="traffic_congestion">Heavy Idling / Traffic Plume</option>
              <option value="industrial_smoke">Industrial Smoke Stack</option>
              <option value="other">Other Local Hazard</option>
            </select>
          </div>
          <div>
            <label htmlFor="report-desc" className="block text-xs font-medium text-[var(--ag-muted)] mb-1">
              Details & Nearest Landmark
            </label>
            <textarea
              id="report-desc"
              rows={2}
              required
              minLength={5}
              value={reportDesc}
              onChange={(e) => {
                setReportDesc(e.target.value)
                if (reportStatus) setReportStatus('')
              }}
              placeholder="Describe visible smoke, road dust, or burning location..."
              className="w-full p-3 rounded-xl border border-[var(--ag-border)] bg-[var(--ag-surface-elevated)] text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full min-h-[42px] rounded-xl bg-[var(--ag-accent)] text-white text-xs font-semibold cursor-pointer"
          >
            Submit Community Report
          </button>
          {reportStatus ? (
            <div role="status" className="text-xs text-emerald-500">
              {reportStatus}
            </div>
          ) : null}
        </form>
      </div>

      {/* Action Campaigns with Real DB Pledges */}
      <section className="ag-glass rounded-3xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--ag-emerald)]" aria-hidden="true" />
            Collective Community Initiatives
          </h3>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter community campaigns">
            {[
              { id: 'all', label: 'All' },
              { id: 'transport', label: 'Transit & Carpool' },
              { id: 'waste', label: 'Zero Burning' },
              { id: 'plantation', label: 'Plantation' },
              { id: 'energy_indoor', label: 'Clean Air Hubs' },
              { id: 'civic_advocacy', label: 'Civic Reporting' },
            ].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCatFilter(c.id)}
                aria-pressed={catFilter === c.id}
                className={`px-3 py-1 rounded-full text-xs font-medium border cursor-pointer ${
                  catFilter === c.id
                    ? 'bg-[var(--ag-accent)] text-white border-transparent'
                    : 'border-[var(--ag-border)] text-[var(--ag-muted)]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredActions.map((act) => (
            <article key={act.id} className="rounded-2xl border border-[var(--ag-border)] p-4 flex flex-col justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-[var(--ag-accent)]">
                    {act.category.replace('_', ' ')} · {act.impact} impact
                  </span>
                  <span className="text-xs text-[var(--ag-muted)] tabular-nums">{act.pledge_count} pledge(s)</span>
                </div>
                <h4 className="font-bold text-sm">{act.title}</h4>
                <p className="text-xs text-[var(--ag-muted)] leading-relaxed">{act.description}</p>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--ag-border)]">
                <div className="flex flex-wrap gap-1">
                  {act.tags.map((t) => (
                    <span key={t} className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--ag-border)] text-[var(--ag-muted)]">
                      {t}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void togglePledge(act.id)}
                  aria-pressed={act.user_pledged}
                  className={`shrink-0 min-h-[36px] px-3.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                    act.user_pledged
                      ? 'bg-emerald-600 text-white'
                      : 'border border-[var(--ag-border)] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  {act.user_pledged ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : null}
                  {act.user_pledged ? 'Pledged' : 'Join Action'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Policy Summaries */}
      <section className="ag-glass rounded-3xl p-6 space-y-4">
        <h3 className="text-base font-bold flex items-center gap-2">
          <Landmark className="w-4 h-4 text-[var(--ag-accent)]" aria-hidden="true" />
          Government Policies & Official Advisories
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {community.policy_summaries.map((pol) => (
            <article key={pol.title} className="rounded-2xl border border-[var(--ag-border)] p-4 flex flex-col justify-between gap-3 text-xs">
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-[var(--ag-accent)]">{pol.jurisdiction}</div>
                <h4 className="font-bold text-sm">{pol.title}</h4>
                <p className="text-[var(--ag-muted)] leading-relaxed">{pol.summary}</p>
              </div>
              <div className="pt-2 border-t border-[var(--ag-border)] space-y-1">
                <div className="font-medium">{pol.applicable_status}</div>
                <a
                  href={pol.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[var(--ag-accent)] hover:underline"
                >
                  Official Policy Source <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      {community.recent_reports.length > 0 ? (
        <section className="ag-glass rounded-3xl p-5 space-y-2">
          <h3 className="text-sm font-bold">Recent Citizen Reports in {community.location}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            {community.recent_reports.map((r) => (
              <div key={r.id} className="rounded-xl border border-[var(--ag-border)] p-3">
                <div className="font-semibold capitalize">{r.category.replace('_', ' ')}</div>
                <div className="text-[var(--ag-muted)] mt-0.5">{r.description}</div>
                <div className="text-[10px] text-[var(--ag-muted)] mt-1">{formatTimestamp(r.created_at)}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <CitationsDrawer citations={community.citations} title="Policy & Community Playbook Citations" />
    </div>
  )
}
