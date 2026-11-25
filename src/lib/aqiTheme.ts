import type { AQILevel, FreshnessLevel, ObservationType } from '../types/airguard'

export interface AQIVisualMeta {
  color: string
  softBg: string
  border: string
  label: string
}

export const AQI_VISUALS: Record<AQILevel, AQIVisualMeta> = {
  Good: {
    color: '#16a34a',
    softBg: 'rgba(22, 163, 74, 0.14)',
    border: 'rgba(22, 163, 74, 0.35)',
    label: 'Good (0–50)',
  },
  Moderate: {
    color: '#ca8a04',
    softBg: 'rgba(234, 179, 8, 0.15)',
    border: 'rgba(234, 179, 8, 0.38)',
    label: 'Moderate (51–100)',
  },
  'Unhealthy for Sensitive Groups': {
    color: '#ea580c',
    softBg: 'rgba(249, 115, 22, 0.15)',
    border: 'rgba(249, 115, 22, 0.38)',
    label: 'Sensitive Groups (101–150)',
  },
  Unhealthy: {
    color: '#dc2626',
    softBg: 'rgba(239, 68, 68, 0.15)',
    border: 'rgba(239, 68, 68, 0.4)',
    label: 'Unhealthy (151–200)',
  },
  'Very Unhealthy': {
    color: '#9333ea',
    softBg: 'rgba(168, 85, 247, 0.16)',
    border: 'rgba(168, 85, 247, 0.4)',
    label: 'Very Unhealthy (201–300)',
  },
  Hazardous: {
    color: '#b91c1c',
    softBg: 'rgba(185, 28, 28, 0.2)',
    border: 'rgba(185, 28, 28, 0.45)',
    label: 'Hazardous (301+)',
  },
  Unavailable: {
    color: '#64748b',
    softBg: 'rgba(100, 116, 139, 0.14)',
    border: 'rgba(100, 116, 139, 0.35)',
    label: 'Unavailable',
  },
}

export function getObservationBadge(obs: ObservationType): { label: string; detail: string; tone: string } {
  switch (obs) {
    case 'official_monitoring_station':
      return {
        label: 'Official Station',
        detail: 'Direct government sensor observation',
        tone: '#16a34a',
      }
    case 'modelled_estimate':
      return {
        label: 'Modelled Estimate',
        detail: 'Open-Meteo CAMS atmospheric model',
        tone: '#0284c7',
      }
    case 'forecast':
      return {
        label: 'Forecast Model',
        detail: 'Probabilistic forecast estimate',
        tone: '#7c3aed',
      }
    default:
      return {
        label: 'Unavailable',
        detail: 'Not continuously measured',
        tone: '#64748b',
      }
  }
}

export function formatFreshnessLabel(freshness: FreshnessLevel, mins?: number | null): string {
  if (freshness === 'unavailable') return 'Timestamp unavailable'
  if (mins === null || mins === undefined) return freshness
  if (mins < 2) return 'Just updated'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  return `${hrs}h ago`
}

export function formatTimestamp(ts?: string | null): string {
  if (!ts) return 'Unavailable'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
