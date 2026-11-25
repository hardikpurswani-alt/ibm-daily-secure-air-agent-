import { BookOpen, ExternalLink } from 'lucide-react'
import type { RAGCitation } from '../types/airguard'

interface Props {
  citations: RAGCitation[]
  title?: string
}

export function CitationsDrawer({ citations, title = 'Verified Knowledge Sources & RAG Citations' }: Props) {
  if (!citations.length) return null

  return (
    <section className="rounded-2xl border border-[var(--ag-border)] bg-[var(--ag-surface)] p-4 space-y-3" aria-label={title}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--ag-muted)] flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-[var(--ag-accent)]" aria-hidden="true" />
          {title}
        </h3>
        <span className="text-[11px] text-[var(--ag-muted)]">{citations.length} source(s)</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {citations.map((c) => (
          <article
            key={`${c.doc_id}-${c.section}`}
            className="rounded-xl border border-[var(--ag-border)] p-3 text-xs space-y-1.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold text-[var(--ag-text)] leading-snug">
                {c.title} · <span className="text-[var(--ag-accent)]">{c.section}</span>
              </div>
              <a
                href={c.source_url}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 inline-flex items-center gap-1 text-[var(--ag-accent)] hover:underline font-medium"
                aria-label={`Open official source: ${c.title}`}
              >
                Source <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>
            </div>
            <p className="text-[var(--ag-muted)] leading-relaxed">{c.excerpt}</p>
            <div className="text-[11px] text-[var(--ag-muted)] flex justify-between">
              <span>{c.source_org} ({c.published_year})</span>
              <span className="tabular-nums">Relevance {Math.round(c.relevance_score * 100)}%</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
