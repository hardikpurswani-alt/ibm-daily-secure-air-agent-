// ─────────────────────────────────────────────────────────────────────────────
// Health Advisory Agent
// Uses IBM Granite to generate personalized health recommendations based on AQI
// ─────────────────────────────────────────────────────────────────────────────

import { callGranite } from '../services/graniteClient';
import type { AQIReading, HealthAdvisory, PersonalProfile, RiskGroup } from './types';

const RISK_GROUPS: RiskGroup[] = [
  'General Public',
  'Children',
  'Elderly',
  'Respiratory Patients',
  'Cardiovascular Patients',
  'Athletes',
];

/** Generate health advisories for all risk groups using IBM Granite */
export async function generateHealthAdvisories(
  reading: AQIReading,
  profile?: PersonalProfile,
): Promise<HealthAdvisory[]> {
  const advisories = await Promise.all(
    RISK_GROUPS.map((group) => generateAdvisoryForGroup(reading, group, profile)),
  );
  return advisories;
}

async function generateAdvisoryForGroup(
  reading: AQIReading,
  group: RiskGroup,
  _profile?: PersonalProfile,
): Promise<HealthAdvisory> {
  const prompt = buildHealthPrompt(reading, group);

  const graniteInsight = await callGranite({
    model: 'ibm/granite-13b-instruct-v2',
    messages: [
      {
        role: 'system',
        content:
          'You are an expert environmental health advisor. Provide concise, actionable health guidance based on air quality data. Focus on practical recommendations. Keep responses under 150 words.',
      },
      { role: 'user', content: prompt },
    ],
    parameters: { max_new_tokens: 200, temperature: 0.3 },
  });

  return buildAdvisory(reading, group, graniteInsight);
}

function buildHealthPrompt(reading: AQIReading, group: RiskGroup): string {
  return `Provide a health advisory for ${group} given:
- AQI: ${reading.aqi} (${reading.level})
- Dominant pollutant: ${reading.dominantPollutant}
- Location: ${reading.location.city}
- PM2.5: ${reading.pollutants.find((p) => p.name === 'PM2.5')?.value ?? 'N/A'} µg/m³

Include: risk level, main recommendation, and 2-3 specific actions. Focus on health advisory.`;
}

function buildAdvisory(
  reading: AQIReading,
  group: RiskGroup,
  graniteInsight: string,
): HealthAdvisory {
  const aqi = reading.aqi;

  // Compute base risk level per group
  let riskLevel: HealthAdvisory['riskLevel'] = 'Low';
  const sensitiveFactor: Record<RiskGroup, number> = {
    'General Public': 1,
    Children: 1.5,
    Elderly: 1.5,
    'Respiratory Patients': 2,
    'Cardiovascular Patients': 2,
    Athletes: 1.3,
  };
  const effectiveAqi = aqi * sensitiveFactor[group];
  if (effectiveAqi > 300) riskLevel = 'Critical';
  else if (effectiveAqi > 150) riskLevel = 'High';
  else if (effectiveAqi > 75) riskLevel = 'Medium';

  const BASE_ADVISORIES: Record<HealthAdvisory['riskLevel'], {
    recommendation: string;
    actions: string[];
    avoidActivities: string[];
    symptoms: string[];
  }> = {
    Low: {
      recommendation: 'Air quality is acceptable. Normal outdoor activities are fine.',
      actions: [
        'Continue regular outdoor activities',
        'Stay hydrated throughout the day',
        'Monitor air quality if planning extended outdoor exercise',
      ],
      avoidActivities: [],
      symptoms: ['None expected at this level'],
    },
    Medium: {
      recommendation: 'Unusually sensitive individuals should consider reducing prolonged outdoor exertion.',
      actions: [
        'Limit prolonged outdoor activity to 2 hours or less',
        'Wear an N95 mask if outdoors for extended periods',
        'Keep windows closed during peak traffic hours',
        'Use HEPA air purifier indoors',
      ],
      avoidActivities: ['High-intensity outdoor exercise for sensitive individuals'],
      symptoms: ['Mild eye irritation', 'Slight throat dryness', 'Occasional coughing'],
    },
    High: {
      recommendation: 'Everyone should reduce prolonged or heavy outdoor exertion. Sensitive groups should stay indoors.',
      actions: [
        'Stay indoors with windows and doors closed',
        'Run air purifier on high setting',
        'Avoid driving—use public transport or stay home',
        'Take prescribed respiratory medications proactively',
        'Check on elderly neighbors and children',
      ],
      avoidActivities: ['Any outdoor exercise', 'Opening windows', 'Burning candles or incense indoors'],
      symptoms: ['Coughing', 'Shortness of breath', 'Chest tightness', 'Eye and throat irritation'],
    },
    Critical: {
      recommendation: 'Health warning: Everyone may experience serious health effects. Avoid all outdoor activities.',
      actions: [
        'Remain indoors at all times',
        'Seal gaps around doors and windows with tape or towels',
        'Set HVAC to recirculate indoor air (do not bring in outside air)',
        'Have emergency medication readily accessible',
        'Contact healthcare provider if symptoms develop',
        'Follow official evacuation guidance if issued',
      ],
      avoidActivities: ['Any outdoor exposure', 'Using fireplace', 'Vigorous indoor exercise', 'Opening any windows'],
      symptoms: ['Severe coughing', 'Difficulty breathing', 'Dizziness', 'Chest pain', 'Aggravated asthma'],
    },
  };

  const base = BASE_ADVISORIES[riskLevel];

  return {
    riskGroup: group,
    riskLevel,
    recommendation: base.recommendation,
    actions: base.actions,
    avoidActivities: base.avoidActivities,
    symptoms: base.symptoms,
    emergencyGuidance:
      riskLevel === 'Critical'
        ? 'Call emergency services (911) if you experience severe difficulty breathing, chest pain, or loss of consciousness.'
        : undefined,
    graniteInsight,
  };
}

/** Generate a single personalized advisory for the user's profile */
export async function getPersonalizedAdvisory(
  reading: AQIReading,
  profile: PersonalProfile,
): Promise<HealthAdvisory> {
  let group: RiskGroup = 'General Public';
  if (profile.ageGroup === 'child') group = 'Children';
  else if (profile.ageGroup === 'elderly') group = 'Elderly';
  else if (profile.conditions.includes('asthma') || profile.conditions.includes('copd')) {
    group = 'Respiratory Patients';
  } else if (profile.conditions.includes('heart')) {
    group = 'Cardiovascular Patients';
  } else if (profile.activityLevel === 'active') {
    group = 'Athletes';
  }

  return generateAdvisoryForGroup(reading, group, profile);
}
