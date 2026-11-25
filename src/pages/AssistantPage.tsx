import { useState } from 'react'
import { Bot, MessageSquarePlus, Send, Sparkles, User } from 'lucide-react'
import { CitationsDrawer } from '../components/CitationsDrawer'
import { formatTimestamp } from '../lib/aqiTheme'
import { useAirGuardStore } from '../store/useAirGuardStore'

const STARTER_PROMPTS = [
  'Is the air safe today?',
  'What precautions should I take?',
  "What will tomorrow's AQI look like?",
  'Should I change my outdoor activity?',
  'What can our community do to reduce pollution?',
]

export function AssistantPage() {
  const {
    selectedCity,
    chatSessions,
    activeSessionId,
    chatMessages,
    isChatLoading,
    sendChatMessage,
    loadChatSession,
    startNewChatSession,
    briefing,
  } = useAirGuardStore()

  const [input, setInput] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isChatLoading) return
    setInput('')
    await sendChatMessage(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      // Allow normal form submit
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Air Quality Chat Assistant</h2>
          <p className="text-sm text-[var(--ag-muted)]">
            Connected to Coordinator Agent <span className="font-mono text-xs">{briefing?.coordinator_agent_id || '9804aee5-5298-40dc-930c-46d17a839fde'}</span> · Active city:{' '}
            <strong className="text-[var(--ag-text)]">{selectedCity}</strong>
          </p>
        </div>

        <button
          type="button"
          onClick={startNewChatSession}
          className="min-h-[42px] px-4 py-2 rounded-full border border-[var(--ag-border)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <MessageSquarePlus className="w-4 h-4 text-[var(--ag-accent)]" aria-hidden="true" />
          New Conversation
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Session History Rail */}
        <aside className="lg:col-span-3 ag-glass rounded-3xl p-4 space-y-3 h-fit">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--ag-muted)]">
            Saved Conversations
          </h3>
          {chatSessions.length === 0 ? (
            <p className="text-xs text-[var(--ag-muted)]">Ask a question to start your first saved consultation.</p>
          ) : (
            <div className="space-y-1.5 max-h-[340px] overflow-y-auto">
              {chatSessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => void loadChatSession(s.id)}
                  className={`w-full text-left rounded-xl px-3 py-2 text-xs border transition cursor-pointer ${
                    activeSessionId === s.id
                      ? 'border-[var(--ag-accent)] bg-[var(--ag-accent)]/10 font-semibold'
                      : 'border-[var(--ag-border)] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="truncate">{s.title}</div>
                  <div className="text-[10px] text-[var(--ag-muted)] mt-0.5">
                    {s.city} · {formatTimestamp(s.created_at)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* Main Chat Thread */}
        <section className="lg:col-span-9 ag-glass rounded-3xl p-5 flex flex-col gap-4 min-h-[540px]">
          {/* Quick Prompts */}
          <div className="flex flex-wrap gap-2">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={isChatLoading}
                onClick={() => void sendChatMessage(prompt)}
                className="px-3 py-1.5 rounded-full border border-[var(--ag-border)] text-xs font-medium hover:border-[var(--ag-accent)] hover:text-[var(--ag-accent)] transition inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" aria-hidden="true" />
                {prompt}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-4 overflow-y-auto max-h-[460px] pr-1">
            {chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 text-sm text-[var(--ag-muted)]">
                <Bot className="w-10 h-10 mb-3 text-[var(--ag-accent)]" aria-hidden="true" />
                <p className="max-w-md">
                  Ask anything about {selectedCity}&apos;s live air quality, personalized health safety, 48-hour forecast
                  uncertainty, or community emission reduction actions.
                </p>
              </div>
            ) : (
              chatMessages.map((m) => (
                <div key={m.id} className="space-y-2.5">
                  <div className={`flex items-start gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}>
                    {m.role === 'assistant' ? (
                      <div className="w-8 h-8 rounded-full bg-[var(--ag-accent)] text-white flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4" aria-hidden="true" />
                      </div>
                    ) : null}

                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-line leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-[var(--ag-accent)] text-white'
                          : 'border border-[var(--ag-border)] bg-[var(--ag-surface-elevated)]'
                      }`}
                    >
                      {m.content}
                      <div className="mt-2 text-[10px] opacity-70 flex flex-wrap gap-2">
                        <span>{formatTimestamp(m.created_at)}</span>
                        {m.coordinator_mode ? <span>· Mode: {m.coordinator_mode}</span> : null}
                      </div>
                    </div>

                    {m.role === 'user' ? (
                      <div className="w-8 h-8 rounded-full border border-[var(--ag-border)] flex items-center justify-center shrink-0">
                        <User className="w-4 h-4" aria-hidden="true" />
                      </div>
                    ) : null}
                  </div>

                  {m.role === 'assistant' && m.trace?.length > 0 ? (
                    <div className="ml-11 flex flex-wrap gap-1.5 text-[11px]">
                      {m.trace.map((t) => (
                        <span
                          key={t.agent_name}
                          className="rounded-full border border-[var(--ag-border)] px-2.5 py-0.5 text-[var(--ag-muted)]"
                          title={t.summary}
                        >
                          {t.agent_name} ({t.latency_ms}ms)
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {m.role === 'assistant' && m.citations?.length > 0 ? (
                    <div className="ml-11">
                      <CitationsDrawer citations={m.citations} title="Turn Source Citations" />
                    </div>
                  ) : null}
                </div>
              ))
            )}

            {isChatLoading ? (
              <div role="status" className="text-xs text-[var(--ag-muted)] flex items-center gap-2 pl-2">
                <Bot className="w-4 h-4 animate-pulse text-[var(--ag-accent)]" aria-hidden="true" />
                Coordinating AQI Data, Health Advisory, Forecasting, Community Action, and RAG Knowledge...
              </div>
            ) : null}
          </div>

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="pt-3 border-t border-[var(--ag-border)] flex gap-2">
            <label htmlFor="assistant-msg-input" className="visually-hidden">
              Ask the AI Air Quality Coordinator
            </label>
            <input
              id="assistant-msg-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask about ${selectedCity} air quality, masks, forecast, or policies...`}
              className="flex-1 min-h-[46px] px-4 rounded-2xl border border-[var(--ag-border)] bg-[var(--ag-surface-elevated)] text-sm"
            />
            <button
              type="submit"
              disabled={isChatLoading || !input.trim()}
              className="min-h-[46px] px-5 rounded-2xl bg-[var(--ag-accent)] text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              Send
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
