// ─────────────────────────────────────────────────────────────────────────────
// Community Insights Panel — Community actions and Granite analysis
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { Users, Tree, MegaphoneSimple, Megaphone, ChartLineUp, Robot } from '@phosphor-icons/react';
import type { CommunityAction, CommunityInsight } from '../agents/types';

interface CommunityPanelProps {
  insight: CommunityInsight | null;
  isLoading: boolean;
}

const CATEGORY_CONFIG = {
  reduce: { label: 'Reduce', color: '#22c55e', Icon: Tree },
  protect: { label: 'Protect', color: '#3b82f6', Icon: MegaphoneSimple },
  report: { label: 'Report', color: '#f59e0b', Icon: Megaphone },
  advocate: { label: 'Advocate', color: '#a855f7', Icon: ChartLineUp },
};

const TREND_CONFIG = {
  improving: { color: '#22c55e', label: '↑ Improving' },
  stable: { color: '#94a3b8', label: '→ Stable' },
  worsening: { color: '#ef4444', label: '↓ Worsening' },
};

function ActionCard({ action }: { action: CommunityAction }) {
  const { color, Icon } = CATEGORY_CONFIG[action.category];
  const impactColors = { low: '#94a3b8', medium: '#f59e0b', high: '#22c55e' };
  const difficultyColors = { easy: '#22c55e', moderate: '#f59e0b', hard: '#ef4444' };

  return (
    <div style={{ ...styles.actionCard, borderColor: `${color}33` }} className="glass-card">
      <div style={styles.actionHeader}>
        <div style={{ ...styles.categoryBadge, background: `${color}22`, color }}>
          <Icon size={12} weight="fill" aria-hidden />
          {CATEGORY_CONFIG[action.category].label}
        </div>
        {action.verified && (
          <span style={styles.verifiedBadge} title="Community verified">✓ Verified</span>
        )}
      </div>

      <div style={styles.actionTitle}>{action.title}</div>
      <div style={styles.actionDesc}>{action.description}</div>

      <div style={styles.actionMeta}>
        <div style={styles.metaItem}>
          <Users size={12} aria-hidden />
          <span>{action.participants.toLocaleString()} participants</span>
        </div>
        <div style={{ ...styles.metaPill, color: impactColors[action.impact] }}>
          {action.impact} impact
        </div>
        <div style={{ ...styles.metaPill, color: difficultyColors[action.difficulty] }}>
          {action.difficulty}
        </div>
      </div>

      <div style={styles.tags}>
        {action.tags.map((t) => (
          <span key={t} style={styles.tag}>{t}</span>
        ))}
      </div>
    </div>
  );
}

export function CommunityPanel({ insight, isLoading }: CommunityPanelProps) {
  const [filter, setFilter] = useState<CommunityAction['category'] | 'all'>('all');

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="skeleton" style={{ height: 80, borderRadius: 10 }} />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 120, borderRadius: 10 }} />
        ))}
      </div>
    );
  }

  if (!insight) {
    return <div style={styles.empty}>Community data loading...</div>;
  }

  const trendConf = TREND_CONFIG[insight.trend];
  const filteredActions = insight.communityActions.filter(
    (a) => filter === 'all' || a.category === filter,
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Overview card */}
      <div style={styles.overviewCard} className="glass-card">
        <div style={styles.overviewGrid}>
          <div style={styles.overviewItem}>
            <div style={styles.overviewLabel}>Region</div>
            <div style={styles.overviewValue}>{insight.region}</div>
          </div>
          <div style={styles.overviewItem}>
            <div style={styles.overviewLabel}>Trend</div>
            <div style={{ ...styles.overviewValue, color: trendConf.color }}>{trendConf.label}</div>
          </div>
          <div style={styles.overviewItem}>
            <div style={styles.overviewLabel}>Reports</div>
            <div style={{ ...styles.overviewValue, color: '#3b82f6' }}>{insight.reportCount}</div>
          </div>
          <div style={styles.overviewItem}>
            <div style={styles.overviewLabel}>Main Source</div>
            <div style={{ ...styles.overviewValue, fontSize: 11 }}>{insight.pollutionSource}</div>
          </div>
        </div>
      </div>

      {/* IBM Granite community analysis */}
      <div style={styles.graniteCard}>
        <div style={styles.graniteHeader}>
          <Robot size={14} weight="fill" aria-hidden style={{ color: '#3b82f6' }} />
          <span style={styles.graniteLabel}>IBM Granite Community Analysis</span>
        </div>
        <p style={styles.graniteText}>{insight.graniteAnalysis}</p>
      </div>

      {/* Category filter */}
      <div style={styles.filterRow} role="group" aria-label="Filter community actions">
        <button
          style={{ ...styles.filterBtn, ...(filter === 'all' ? styles.filterBtnActive : {}) }}
          onClick={() => setFilter('all')}
          aria-pressed={filter === 'all'}
        >
          All
        </button>
        {Object.entries(CATEGORY_CONFIG).map(([key, { label, color }]) => (
          <button
            key={key}
            style={{
              ...styles.filterBtn,
              ...(filter === key ? { background: `${color}22`, borderColor: color, color } : {}),
            }}
            onClick={() => setFilter(key as CommunityAction['category'])}
            aria-pressed={filter === key}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Action cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filteredActions.map((action) => (
          <ActionCard key={action.id} action={action} />
        ))}
      </div>

      <div style={styles.footer}>
        Last updated: {new Date(insight.lastUpdated).toLocaleTimeString()}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overviewCard: {
    padding: '14px 16px',
  },
  overviewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 12,
  },
  overviewItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  overviewLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontFamily: 'Fira Code, monospace',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  overviewValue: {
    fontSize: 14,
    fontWeight: 600,
    color: '#f8fafc',
    fontFamily: 'Fira Code, monospace',
  },
  graniteCard: {
    background: 'rgba(59, 130, 246, 0.08)',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    borderRadius: 10,
    padding: '12px 14px',
  },
  graniteHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  graniteLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#3b82f6',
    fontFamily: 'Fira Code, monospace',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  graniteText: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 1.6,
  },
  filterRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  filterBtn: {
    padding: '4px 12px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent',
    color: '#94a3b8',
    fontSize: 11,
    fontFamily: 'Fira Code, monospace',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  filterBtnActive: {
    background: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.3)',
    color: '#f8fafc',
  },
  actionCard: {
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    border: '1px solid',
    borderRadius: 10,
  },
  actionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 10,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 999,
    fontFamily: 'Fira Code, monospace',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  verifiedBadge: {
    fontSize: 10,
    color: '#22c55e',
    fontFamily: 'Fira Code, monospace',
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#f8fafc',
  },
  actionDesc: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 1.5,
  },
  actionMeta: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    color: '#94a3b8',
  },
  metaPill: {
    fontSize: 10,
    fontFamily: 'Fira Code, monospace',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
  },
  tag: {
    fontSize: 10,
    padding: '1px 6px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 999,
    color: '#64748b',
  },
  empty: {
    color: '#94a3b8',
    textAlign: 'center',
    padding: 40,
    fontSize: 13,
  },
  footer: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    fontFamily: 'Fira Code, monospace',
    textAlign: 'center',
  },
};
