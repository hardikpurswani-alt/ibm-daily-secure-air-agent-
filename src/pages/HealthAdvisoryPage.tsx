import { useState } from 'react'
import { Bot, Check, HeartPulse, ShieldAlert, Trash2 } from 'lucide-react'
import { CitationsDrawer } from '../components/CitationsDrawer'
import { useAirGuardStore } from '../store/useAirGuardStore'
import type { HealthProfileInput } from '../types/airguard'

const CONSIDERATION_OPTIONS = [
  { id: 'asthma', label: 'Asthma / Reactive Airways' },
  { id: 'copd', label: 'COPD / Chronic Bronchitis' },
  { id: 'cardiovascular', label: 'Cardiovascular Sensitivity' },
  { id: 'pregnancy', label: 'Pregnancy' },
  { id: 'allergies', label: 'Allergic Rhinitis / Sinus Sensitivity' },
]

export function HealthAdvisoryPage() {
  const { briefing, preferences, updateHealthAdvisory, savePreferences, clearHealthPreferences } = useAirGuardStore()

  if (!briefing) return null
  const prefKey = `${preferences.age_group || 'adult'}-${preferences.outdoor_activity || 'moderate'}-${(preferences.health_considerations || []).join(',')}`

  return (
    <HealthAdvisoryInner
      key={prefKey}
      briefing={briefing}
      preferences={preferences}
      updateHealthAdvisory={updateHealthAdvisory}
      savePreferences={savePreferences}
      clearHealthPreferences={clearHealthPreferences}
    />
  )
}

function HealthAdvisoryInner({
  briefing,
  preferences,
  updateHealthAdvisory,
  savePreferences,
  clearHealthPreferences,
}: {
  briefing: NonNullable<ReturnType<typeof useAirGuardStore.getState>['briefing']>
  preferences: ReturnType<typeof useAirGuardStore.getState>['preferences']
  updateHealthAdvisory: ReturnType<typeof useAirGuardStore.getState>['updateHealthAdvisory']
  savePreferences: ReturnType<typeof useAirGuardStore.getState>['savePreferences']
  clearHealthPreferences: ReturnType<typeof useAirGuardStore.getState>['clearHealthPreferences']
}) {
  const [ageGroup, setAgeGroup] = useState<HealthProfileInput['age_group']>(preferences.age_group || 'adult')
  const [activity, setActivity] = useState<HealthProfileInput['outdoor_activity']>(preferences.outdoor_activity || 'moderate')
  const [considerations, setConsiderations] = useState<string[]>(preferences.health_considerations || [])
  const [saving, setSaving] = useState(false)
  const [savedNotice, setSavedNotice] = useState('')

  const { health_advisory } = briefing

  const toggleConsideration = (id: string) => {
    setConsiderations((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSavedNotice('')
    try {
      await savePreferences({
        ...preferences,
        age_group: ageGroup,
        outdoor_activity: activity,
        health_considerations: considerations,
      })
      await updateHealthAdvisory({
        age_group: ageGroup,
        outdoor_activity: activity,
        health_considerations: considerations,
      })
      setSavedNotice('Updated personalized advisory and saved preferences.')
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    setConsiderations([])
    setAgeGroup('adult')
    setActivity('moderate')
    await clearHealthPreferences()
    setSavedNotice('Optional health considerations erased.')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Personalized Health Advisory</h2>
        <p className="text-sm text-[var(--ag-muted)]">
          Preventive daily precautions for {health_advisory.location} (AQI {health_advisory.aqi ?? '—'} · {health_advisory.level}).
        </p>
      </div>

      {/* Explicit Non-Diagnostic Safety Banner */}
      <div
        role="note"
        className="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 text-xs flex items-start gap-2.5"
      >
        <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="leading-relaxed">{health_advisory.medical_disclaimer}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Editable & Removable Personal Profile Form */}
        <form onSubmit={handleApply} className="lg:col-span-5 ag-glass rounded-3xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-rose-500" aria-hidden="true" />
              Personal Exposure Profile
            </h3>
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-rose-500 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              Remove Health Data
            </button>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold uppercase tracking-wider text-[var(--ag-muted)]">Age Group</legend>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'child', label: 'Child / Youth' },
                { id: 'adult', label: 'Adult' },
                { id: 'older_adult', label: 'Older Adult (65+)' },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-medium flex items-center gap-2 cursor-pointer ${
                    ageGroup === opt.id ? 'border-[var(--ag-accent)] bg-[var(--ag-accent)]/10' : 'border-[var(--ag-border)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="age_group"
                    value={opt.id}
                    checked={ageGroup === opt.id}
                    onChange={() => setAgeGroup(opt.id as HealthProfileInput['age_group'])}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold uppercase tracking-wider text-[var(--ag-muted)]">
              Outdoor Activity Level
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'low', label: 'Mostly Indoors' },
                { id: 'moderate', label: 'Moderate Walks / Commute' },
                { id: 'high', label: 'Vigorous Outdoor Exercise' },
                { id: 'outdoor_worker', label: 'Extended Outdoor Work' },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-medium flex items-center gap-2 cursor-pointer ${
                    activity === opt.id ? 'border-[var(--ag-accent)] bg-[var(--ag-accent)]/10' : 'border-[var(--ag-border)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="outdoor_activity"
                    value={opt.id}
                    checked={activity === opt.id}
                    onChange={() => setActivity(opt.id as HealthProfileInput['outdoor_activity'])}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold uppercase tracking-wider text-[var(--ag-muted)]">
              Optional Health Considerations (Removable)
            </legend>
            <div className="space-y-2">
              {CONSIDERATION_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className="flex items-center gap-2.5 rounded-xl border border-[var(--ag-border)] px-3 py-2 text-xs cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={considerations.includes(opt.id)}
                    onChange={() => toggleConsideration(opt.id)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-[44px] rounded-2xl bg-[var(--ag-accent)] text-white text-sm font-semibold disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Generating Advisory...' : 'Update Personalized Guidance'}
          </button>

          {savedNotice ? (
            <div role="status" className="text-xs text-emerald-500 flex items-center gap-1.5">
              <Check className="w-4 h-4" aria-hidden="true" />
              {savedNotice}
            </div>
          ) : null}
        </form>

        {/* AI Guidance Output */}
        <div className="lg:col-span-7 space-y-5">
          <section className="ag-glass rounded-3xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ag-accent)] flex items-center gap-1.5">
                <Bot className="w-4 h-4" aria-hidden="true" />
                {health_advisory.reasoning_mode === 'ibm_watsonx_granite'
                  ? 'IBM Granite Health Synthesis'
                  : 'RAG-Grounded Health Synthesis'}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold border border-[var(--ag-border)]">
                Risk Level: {health_advisory.personalized_risk_level}
              </span>
            </div>

            <h3 className="text-lg font-bold">{health_advisory.headline_recommendation}</h3>
            <p className="text-sm text-[var(--ag-muted)] leading-relaxed">{health_advisory.granite_analysis}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="rounded-2xl border border-[var(--ag-border)] p-4 space-y-1">
                <div className="font-bold text-[var(--ag-text)]">Outdoor Activity Adjustment</div>
                <p className="text-[var(--ag-muted)] leading-relaxed">{health_advisory.outdoor_activity_guidance}</p>
              </div>
              <div className="rounded-2xl border border-[var(--ag-border)] p-4 space-y-1">
                <div className="font-bold text-[var(--ag-text)]">Mask & Indoor Air Guidance</div>
                <p className="text-[var(--ag-muted)] leading-relaxed">{health_advisory.mask_and_indoor_guidance}</p>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--ag-muted)] mb-2">
                Daily Checklist
              </div>
              <ul className="space-y-2 text-xs">
                {health_advisory.daily_precautions.map((item, idx) => (
                  <li key={idx} className="rounded-xl border border-[var(--ag-border)] px-3.5 py-2.5 flex items-start gap-2">
                    <Check className="w-4 h-4 text-[var(--ag-emerald)] shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Group Matrix */}
          <section className="ag-glass rounded-3xl p-6 space-y-3">
            <h3 className="text-base font-bold">Population Vulnerability Breakdown</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {health_advisory.group_advisories.map((g) => (
                <article key={g.risk_group} className="rounded-2xl border border-[var(--ag-border)] p-3.5 text-xs space-y-1.5">
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-bold">{g.risk_group}</span>
                    <span className="px-2 py-0.5 rounded-full border border-[var(--ag-border)] text-[10px] font-semibold">
                      {g.risk_level}
                    </span>
                  </div>
                  <p className="text-[var(--ag-muted)]">{g.summary}</p>
                  <div className="text-[11px] text-[var(--ag-accent)]">Mask: {g.mask_guidance}</div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>

      <CitationsDrawer citations={health_advisory.citations} title="Medical & Environmental Health Guidelines (RAG)" />
    </div>
  )
}
