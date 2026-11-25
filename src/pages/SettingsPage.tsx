import { useState } from 'react'
import { Check, Cloud, Eye, EyeOff, KeyRound, Lock, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import { useAirGuardStore } from '../store/useAirGuardStore'
import type { PreferencesPayload } from '../types/airguard'

export function SettingsPage() {
  const store = useAirGuardStore()
  const prefKey = `${store.preferences.default_city}-${store.preferences.aqi_standard}-${store.preferences.theme_preference}-${store.preferences.alert_aqi_threshold}-${store.preferences.location_consent_granted}-${store.preferences.health_considerations.join(',')}`
  return <SettingsPageInner key={prefKey} {...store} />
}

function SettingsPageInner({
  preferences,
  savePreferences,
  applyThemePreference,
  clearHealthPreferences,
  revokeLocationConsent,
  systemStatus,
  refreshStatus,
  authUser,
  login,
  register,
  logout,
}: ReturnType<typeof useAirGuardStore.getState>) {
  const [form, setForm] = useState<PreferencesPayload>(preferences)
  const [savedMsg, setSavedMsg] = useState('')
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [authError, setAuthError] = useState('')

  const handleSavePrefs = async (e: React.FormEvent) => {
    e.preventDefault()
    await savePreferences(form)
    setSavedMsg('Preferences saved securely.')
  }

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    try {
      if (authMode === 'login') {
        await login(email, password)
      } else {
        await register(email, fullName, password)
      }
      setPassword('')
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed.')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings, Privacy & IBM Integration Status</h2>
        <p className="text-sm text-[var(--ag-muted)]">
          Manage location consent, removable health preferences, theme, alert thresholds, and live IBM watsonx connectivity.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Preferences Form */}
        <form onSubmit={handleSavePrefs} className="lg:col-span-6 ag-glass rounded-3xl p-6 space-y-5">
          <h3 className="text-base font-bold">Application & Alert Preferences</h3>

          <div className="space-y-1.5">
            <label htmlFor="pref-default-city" className="block text-xs font-semibold text-[var(--ag-muted)]">
              Default Monitored City
            </label>
            <input
              id="pref-default-city"
              type="text"
              required
              value={form.default_city}
              onChange={(e) => setForm({ ...form, default_city: e.target.value })}
              className="w-full min-h-[42px] px-3.5 rounded-xl border border-[var(--ag-border)] bg-[var(--ag-surface-elevated)] text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="pref-scale" className="block text-xs font-semibold text-[var(--ag-muted)]">
                Preferred AQI Scale
              </label>
              <select
                id="pref-scale"
                value={form.aqi_standard}
                onChange={(e) => setForm({ ...form, aqi_standard: e.target.value as PreferencesPayload['aqi_standard'] })}
                className="w-full min-h-[42px] px-3 rounded-xl border border-[var(--ag-border)] bg-[var(--ag-surface-elevated)] text-sm"
              >
                <option value="us_epa">US EPA AQI</option>
                <option value="india_naqi">India CPCB NAQI</option>
                <option value="eu_eaqi">European EAQI</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="pref-threshold" className="block text-xs font-semibold text-[var(--ag-muted)]">
                Alert Threshold (AQI)
              </label>
              <input
                id="pref-threshold"
                type="number"
                min={25}
                max={450}
                value={form.alert_aqi_threshold}
                onChange={(e) => setForm({ ...form, alert_aqi_threshold: Number(e.target.value) || 100 })}
                className="w-full min-h-[42px] px-3 rounded-xl border border-[var(--ag-border)] bg-[var(--ag-surface-elevated)] text-sm tabular-nums"
              />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-[var(--ag-muted)]">Appearance Theme</legend>
            <div className="grid grid-cols-3 gap-2">
              {(['system', 'light', 'dark'] as const).map((mode) => (
                <label
                  key={mode}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-medium flex items-center gap-2 capitalize cursor-pointer ${
                    form.theme_preference === mode ? 'border-[var(--ag-accent)] bg-[var(--ag-accent)]/10' : 'border-[var(--ag-border)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="theme_preference"
                    value={mode}
                    checked={form.theme_preference === mode}
                    onChange={() => {
                      setForm({ ...form, theme_preference: mode })
                      applyThemePreference(mode)
                    }}
                  />
                  <span>{mode}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex items-center gap-2.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={form.notifications_enabled}
              onChange={(e) => setForm({ ...form, notifications_enabled: e.target.checked })}
            />
            <span>Enable predictive and threshold alert generation</span>
          </label>

          <button
            type="submit"
            className="w-full min-h-[44px] rounded-2xl bg-[var(--ag-accent)] text-white text-sm font-semibold cursor-pointer"
          >
            Save Preferences
          </button>

          {savedMsg ? (
            <div role="status" className="text-xs text-emerald-500 flex items-center gap-1.5">
              <Check className="w-4 h-4" aria-hidden="true" />
              {savedMsg}
            </div>
          ) : null}

          {/* Privacy Controls */}
          <div className="pt-4 border-t border-[var(--ag-border)] space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--ag-muted)]">
              Privacy & Data Controls
            </h4>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void revokeLocationConsent()}
                className="px-3 py-2 rounded-xl border border-[var(--ag-border)] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--ag-accent)]" aria-hidden="true" />
                {preferences.location_consent_granted ? 'Revoke Location Consent' : 'Location Consent Disabled'}
              </button>
              <button
                type="button"
                onClick={() => void clearHealthPreferences()}
                className="px-3 py-2 rounded-xl border border-rose-500/35 text-rose-500 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                Erase Health Considerations
              </button>
            </div>
          </div>
        </form>

        {/* Auth + IBM Cloud Live Diagnostics */}
        <div className="lg:col-span-6 space-y-5">
          {/* Account Authentication */}
          <section className="ag-glass rounded-3xl p-6 space-y-4">
            <h3 className="text-base font-bold flex items-center gap-2">
              <Lock className="w-4 h-4 text-[var(--ag-accent)]" aria-hidden="true" />
              Account Authentication (Optional Sync)
            </h3>

            {authUser ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--ag-border)] p-4 text-xs">
                <div>
                  <div className="font-bold text-sm">{authUser.full_name}</div>
                  <div className="text-[var(--ag-muted)]">{authUser.email}</div>
                </div>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="px-4 py-2 rounded-xl border border-[var(--ag-border)] font-semibold cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <form onSubmit={handleAuthSubmit} className="space-y-3">
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className={`px-3 py-1.5 rounded-full border font-semibold cursor-pointer ${
                      authMode === 'login' ? 'bg-[var(--ag-accent)] text-white border-transparent' : 'border-[var(--ag-border)]'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('register')}
                    className={`px-3 py-1.5 rounded-full border font-semibold cursor-pointer ${
                      authMode === 'register' ? 'bg-[var(--ag-accent)] text-white border-transparent' : 'border-[var(--ag-border)]'
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                {authMode === 'register' ? (
                  <div>
                    <label htmlFor="auth-name" className="block text-xs font-medium text-[var(--ag-muted)] mb-1">
                      Full Name
                    </label>
                    <input
                      id="auth-name"
                      type="text"
                      required
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full min-h-[42px] px-3 rounded-xl border border-[var(--ag-border)] bg-[var(--ag-surface-elevated)] text-sm"
                    />
                  </div>
                ) : null}

                <div>
                  <label htmlFor="auth-email" className="block text-xs font-medium text-[var(--ag-muted)] mb-1">
                    Email
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full min-h-[42px] px-3 rounded-xl border border-[var(--ag-border)] bg-[var(--ag-surface-elevated)] text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="auth-pwd" className="block text-xs font-medium text-[var(--ag-muted)] mb-1">
                    Password (min 8 characters)
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="auth-pwd"
                      type={showPwd ? 'text' : 'password'}
                      required
                      minLength={8}
                      autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full min-h-[42px] pl-3 pr-11 rounded-xl border border-[var(--ag-border)] bg-[var(--ag-surface-elevated)] text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      aria-pressed={showPwd}
                      aria-label={showPwd ? 'Hide password' : 'Show password'}
                      className="absolute right-2 min-w-[34px] min-h-[34px] flex items-center justify-center text-[var(--ag-muted)] cursor-pointer"
                    >
                      {showPwd ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                    </button>
                  </div>
                </div>

                {authError ? <div role="alert" className="text-xs text-rose-500">{authError}</div> : null}

                <button
                  type="submit"
                  className="w-full min-h-[42px] rounded-xl bg-[var(--ag-accent)] text-white text-xs font-semibold cursor-pointer"
                >
                  {authMode === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              </form>
            )}
          </section>

          {/* IBM Live Diagnostics */}
          <section className="ag-glass rounded-3xl p-6 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Cloud className="w-4 h-4 text-[var(--ag-accent)]" aria-hidden="true" />
                IBM Cloud & watsonx Diagnostics
              </h3>
              <button
                type="button"
                onClick={() => void refreshStatus()}
                className="px-3 py-1 rounded-full border border-[var(--ag-border)] inline-flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                Verify
              </button>
            </div>

            {systemStatus ? (
              <div className="space-y-2">
                <div className="rounded-xl border border-[var(--ag-border)] p-3 flex justify-between">
                  <span>IBM watsonx.ai (Granite 3)</span>
                  <span className={systemStatus.ibm_granite.configured ? 'text-emerald-500 font-bold' : 'text-amber-500 font-semibold'}>
                    {systemStatus.ibm_granite.configured ? 'Configured' : 'Awaiting API Key & Project ID'}
                  </span>
                </div>
                <div className="rounded-xl border border-[var(--ag-border)] p-3 space-y-1">
                  <div className="flex justify-between">
                    <span>watsonx Orchestrate Coordinator</span>
                    <span className={systemStatus.watsonx_orchestrate.connected ? 'text-emerald-500 font-bold' : 'text-amber-500 font-semibold'}>
                      {systemStatus.watsonx_orchestrate.connected ? 'Live Connected' : 'Local Coordination Active'}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-[var(--ag-muted)]">
                    Agent ID: {systemStatus.watsonx_orchestrate.agent_id}
                  </div>
                  {systemStatus.watsonx_orchestrate.error ? (
                    <div className="text-amber-500 leading-relaxed flex items-start gap-1.5 pt-1">
                      <KeyRound className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{systemStatus.watsonx_orchestrate.error}</span>
                    </div>
                  ) : null}
                </div>
                <div className="rounded-xl border border-[var(--ag-border)] p-3 flex justify-between">
                  <span>RAG Knowledge Documents</span>
                  <span className="font-semibold">
                    {systemStatus.rag_knowledge.documents_indexed} docs ({systemStatus.rag_knowledge.chunks_indexed} chunks)
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-[var(--ag-muted)]">Loading system diagnostics...</p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
