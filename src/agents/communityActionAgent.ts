// ─────────────────────────────────────────────────────────────────────────────
// Community Action Agent
// Analyzes community-level air quality impacts and suggests collective actions
// Powered by IBM Granite for natural language insights
// ─────────────────────────────────────────────────────────────────────────────

import { callGranite } from '../services/graniteClient';
import type { AQIReading, CommunityAction, CommunityInsight } from './types';

/** Generate community insights and action recommendations */
export async function generateCommunityInsights(reading: AQIReading): Promise<CommunityInsight> {
  const actions = generateCommunityActions(reading);

  const graniteAnalysis = await callGranite({
    model: 'ibm/granite-13b-instruct-v2',
    messages: [
      {
        role: 'system',
        content:
          'You are a community environmental analyst. Provide actionable community-level insights about air quality impacts. Focus on collective actions, local policy, and community health. Keep it under 100 words.',
      },
      {
        role: 'user',
        content: `Analyze community air quality situation for ${reading.location.city}:
- AQI: ${reading.aqi} (${reading.level})
- Dominant pollutant: ${reading.dominantPollutant}
- PM2.5: ${reading.pollutants.find((p) => p.name === 'PM2.5')?.value?.toFixed(1) ?? 'N/A'} µg/m³

What should the community do collectively? What are the pollution sources?`,
      },
    ],
    parameters: { max_new_tokens: 150, temperature: 0.5 },
  });

  const trend = reading.aqi < 50 ? 'improving' : reading.aqi > 150 ? 'worsening' : 'stable';

  return {
    region: reading.location.city,
    pollutionSource: inferPollutionSource(reading),
    reportCount: Math.floor(Math.random() * 300) + 50,
    trend,
    communityActions: actions,
    graniteAnalysis,
    lastUpdated: new Date().toISOString(),
  };
}

function inferPollutionSource(reading: AQIReading): string {
  const dominantPollutant = reading.dominantPollutant.toLowerCase();
  const hour = new Date().getHours();

  if (dominantPollutant.includes('pm2.5') || dominantPollutant.includes('pm10')) {
    if (hour >= 7 && hour <= 9) return 'Traffic emissions (morning rush)';
    if (hour >= 17 && hour <= 19) return 'Traffic emissions (evening rush)';
    return 'Industrial and construction dust';
  }
  if (dominantPollutant.includes('ozone') || dominantPollutant.includes('o3')) {
    return 'Photochemical smog (sunlight + vehicle emissions)';
  }
  if (dominantPollutant.includes('no2')) {
    return 'Vehicle exhaust and industrial burning';
  }
  if (dominantPollutant.includes('so2')) {
    return 'Industrial processes and power plants';
  }
  return 'Mixed urban emissions';
}

function generateCommunityActions(reading: AQIReading): CommunityAction[] {
  const actions: CommunityAction[] = [];
  const aqi = reading.aqi;

  // Always relevant actions
  actions.push({
    id: 'ca-1',
    title: 'Use Public Transportation Today',
    description: 'Reduce vehicle emissions by taking buses, trains, or carpooling instead of driving alone.',
    category: 'reduce',
    impact: 'high',
    difficulty: 'easy',
    participants: 1247,
    verified: true,
    tags: ['transport', 'emissions', 'daily'],
  });

  actions.push({
    id: 'ca-2',
    title: 'Plant Air-Purifying Trees',
    description: 'Join the community tree-planting initiative. Native trees can reduce local particulate matter by up to 25%.',
    category: 'reduce',
    impact: 'high',
    difficulty: 'moderate',
    participants: 342,
    verified: true,
    tags: ['trees', 'long-term', 'community'],
  });

  actions.push({
    id: 'ca-3',
    title: 'Report Visible Pollution Sources',
    description: 'Use the city\'s 311 app or website to report illegal burning, construction dust, or idling vehicles.',
    category: 'report',
    impact: 'medium',
    difficulty: 'easy',
    participants: 892,
    verified: true,
    tags: ['report', 'civic', 'immediate'],
  });

  if (aqi > 100) {
    actions.push({
      id: 'ca-4',
      title: 'Distribute N95 Masks to Vulnerable Residents',
      description: 'Coordinate with local health centers to distribute protective masks to elderly and low-income residents.',
      category: 'protect',
      impact: 'high',
      difficulty: 'moderate',
      participants: 128,
      verified: false,
      tags: ['protection', 'vulnerable', 'immediate'],
    });

    actions.push({
      id: 'ca-5',
      title: 'Advocate for Industrial Emission Limits',
      description: 'Sign and share the petition for stricter industrial emission standards in your area.',
      category: 'advocate',
      impact: 'high',
      difficulty: 'easy',
      participants: 2341,
      verified: true,
      tags: ['policy', 'advocacy', 'petition'],
    });
  }

  if (aqi > 150) {
    actions.push({
      id: 'ca-6',
      title: 'Open Community Clean Air Shelters',
      description: 'Activate community centers as clean air shelters for people without air conditioning or air purifiers.',
      category: 'protect',
      impact: 'high',
      difficulty: 'hard',
      participants: 45,
      verified: false,
      tags: ['shelter', 'emergency', 'community'],
    });
  }

  actions.push({
    id: 'ca-7',
    title: 'Switch to Electric or Hybrid Vehicle',
    description: 'Long-term action: transitioning to EVs can reduce your personal NO2 and PM contribution by over 70%.',
    category: 'reduce',
    impact: 'high',
    difficulty: 'hard',
    participants: 567,
    verified: true,
    tags: ['ev', 'long-term', 'transport'],
  });

  actions.push({
    id: 'ca-8',
    title: 'Install Home Air Quality Monitor',
    description: 'Share real-time indoor/outdoor data with PurpleAir or similar networks to improve community monitoring.',
    category: 'report',
    impact: 'medium',
    difficulty: 'easy',
    participants: 723,
    verified: true,
    tags: ['monitoring', 'data', 'community'],
  });

  return actions;
}
