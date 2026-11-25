// ─────────────────────────────────────────────────────────────────────────────
// Health Advisory Panel — Personalized health recommendations powered by Granite
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { FirstAid, Warning, Shield, Robot, CaretDown, CaretUp } from '@phosphor-icons/react';
import type { HealthAdvisory } from '../agents/types';

interface HealthPanelProps {
  advisories: HealthAdvisory[];
  isLoading: boolean;
}

const RISK_COLORS = {
  Low: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', text: '#22c55e', badge: '#dcfce7' },
  Medium: { bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.3)', text: '#eab308', badge: '#fef9c3' },
  High: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#ef4444', badge: '#fee2e2' },
  Critical: { bg: 'rgba(220,38,38,0.15)', border: 'rgba(220,38,38,0.5)', text: '#dc2626', badge: '#fca5a5' },
};

const GROUP_ICONS: Record<string, React.ReactNode> = {
  'General Public': <Shield size={16} weight="fill" aria-hidden />,
  Children: <FirstAid size={16} weight="fill" aria-hidden />,
  Elderly: <FirstAid size={16} weight="fill" aria-hidden />,
  'Respiratory Patients': <Warning size={16} weight="fill" aria-hidden />,
  'Cardiovascular Patients': <Warning size={16} weight="fill" aria-hidden />,
  Athletes: <Shield size={16} weight="fill" aria-hidden />,
};

function AdvisoryCard({ advisory }: { advisory: HealthAdvisory }) {
  const [expanded, setExpanded] = useState(false);
  const colors = RISK_COLORS[advisory.riskLevel];

  return (
    <div
      style={{ ...styles.card, background: colors.bg, borderColor: colors.border }}
      className="glass-card"
    >
      {/* Header */}
      <button
        style={styles.cardHeader}
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        aria-controls={`advisory-${advisory.riskGroup}`}
      >
        <div style={styles.headerLeft}>
          <span style={{ color: colors.text }}>{GROUP_ICONS[advisory.riskGroup]}</span>
          <span style={{ ...styles.groupName, color: '#f8fafc' }}>{advisory.riskGroup}</span>
        </div>
        <div style={styles.headerRight}>
          <span style={{ ...styles.riskBadge, color: colors.text, background: `${colors.text}22`, border: `1px solid ${colors.border}` }}>
            {advisory.riskLevel}
          </span>
          {expanded
            ? <CaretUp size={14} style={{ color: '#94a3b8' }} aria-hidden />
            : <CaretDown size={14} style={{ color: '#94a3b8' }} aria-hidden />
          }
        </div>
      </button>

      {/* Recommendation */}
      <p style={styles.recommendation}>{advisory.recommendation}</p>

      {/* Expanded content */}
      {expanded && (
        <div id={`advisory-${advisory.riskGroup}`} style={styles.expandedContent}>
          {/* Recommended actions */}
          {advisory.actions.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>✓ Recommended Actions</div>
              <ul style={styles.actionList}>
                {advisory.actions.map((action, i) => (
                  <li key={i} style={styles.actionItem}>
                    <span style={{ color: '#22c55e', marginRight: 6 }}>→</span>
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Activities to avoid */}
          {advisory.avoidActivities.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>✗ Avoid Activities</div>
              <ul style={styles.actionList}>
                {advisory.avoidActivities.map((act, i) => (
                  <li key={i} style={styles.actionItem}>
                    <span style={{ color: '#ef4444', marginRight: 6 }}>✕</span>
                    {act}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Potential symptoms */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>⚠ Watch for Symptoms</div>
            <div style={styles.tags}>
              {advisory.symptoms.map((s, i) => (
                <span key={i} style={styles.tag}>{s}</span>
              ))}
            </div>
          </div>

          {/* Emergency guidance */}
          {advisory.emergencyGuidance && (
            <div style={styles.emergency}>
              <Warning size={14} weight="fill" aria-hidden style={{ flexShrink: 0 }} />
              {advisory.emergencyGuidance}
            </div>
          )}

          {/* IBM Granite insight */}
          <div style={styles.graniteCard}>
            <div style={styles.graniteHeader}>
              <Robot size={12} weight="fill" aria-hidden style={{ color: '#3b82f6' }} />
              <span style={styles.graniteLabel}>IBM Granite Insight</span>
            </div>
            <p style={styles.graniteText}>{advisory.graniteInsight}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function HealthPanel({ advisories, isLoading }: HealthPanelProps) {
  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 70, borderRadius: 10 }} />
        ))}
      </div>
    );
  }

  if (!advisories.length) {
    return <div style={styles.empty}>Health advisories loading...</div>;
  }

  // Sort by risk level severity
  const sorted = [...advisories].sort((a, b) => {
    const order = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    return order[a.riskLevel] - order[b.riskLevel];
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sorted.map((advisory) => (
        <AdvisoryCard key={advisory.riskGroup} advisory={advisory} />
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    width: '100%',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  groupName: {
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'Fira Code, monospace',
  },
  riskBadge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 999,
    fontFamily: 'Fira Code, monospace',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  recommendation: {
    fontSize: 12,
    color: '#cbd5e1',
    lineHeight: 1.5,
  },
  expandedContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 4,
    paddingTop: 12,
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: '#94a3b8',
    fontFamily: 'Fira Code, monospace',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  actionList: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  actionItem: {
    fontSize: 12,
    color: '#cbd5e1',
    lineHeight: 1.5,
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
  },
  tag: {
    fontSize: 10,
    padding: '2px 8px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 999,
    color: '#94a3b8',
  },
  emergency: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
    fontSize: 12,
    color: '#fca5a5',
    background: 'rgba(220,38,38,0.1)',
    border: '1px solid rgba(220,38,38,0.3)',
    borderRadius: 8,
    padding: '8px 10px',
    lineHeight: 1.5,
  },
  graniteCard: {
    background: 'rgba(59, 130, 246, 0.08)',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    borderRadius: 8,
    padding: '10px 12px',
  },
  graniteHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  graniteLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: '#3b82f6',
    fontFamily: 'Fira Code, monospace',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  graniteText: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 1.6,
  },
  empty: {
    color: '#94a3b8',
    textAlign: 'center',
    padding: 40,
    fontSize: 13,
  },
};
