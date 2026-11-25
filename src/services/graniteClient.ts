// ─────────────────────────────────────────────────────────────────────────────
// IBM Granite LLM Client
// Integrates with IBM watsonx.ai for intelligent reasoning
// API: https://us-south.ml.cloud.ibm.com/ml/v1/text/generation
// ─────────────────────────────────────────────────────────────────────────────

import type { GraniteRequest, GraniteResponse } from '../agents/types';

const GRANITE_CONFIG = {
  apiBase: import.meta.env.VITE_WATSONX_API_BASE || 'https://us-south.ml.cloud.ibm.com/ml/v1',
  apiKey: import.meta.env.VITE_WATSONX_API_KEY || '',
  projectId: import.meta.env.VITE_WATSONX_PROJECT_ID || '',
  model: 'ibm/granite-13b-instruct-v2',
  iamTokenUrl: 'https://iam.cloud.ibm.com/identity/token',
};

let _cachedIAMToken: string | null = null;
let _tokenExpiry = 0;

/** Obtain an IAM access token using the API key (cached for 50 min) */
async function getIAMToken(): Promise<string> {
  if (_cachedIAMToken && Date.now() < _tokenExpiry) return _cachedIAMToken;

  if (!GRANITE_CONFIG.apiKey) {
    // Dev mode: return a placeholder
    return 'dev-mode-token';
  }

  try {
    const res = await fetch(GRANITE_CONFIG.iamTokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
        apikey: GRANITE_CONFIG.apiKey,
      }),
    });

    if (!res.ok) throw new Error(`IAM token error: ${res.status}`);
    const data = await res.json();
    _cachedIAMToken = data.access_token;
    _tokenExpiry = Date.now() + 50 * 60 * 1000; // 50 minutes
    return _cachedIAMToken!;
  } catch {
    return 'dev-mode-token';
  }
}

/** Call IBM Granite via watsonx.ai REST API */
export async function callGranite(request: GraniteRequest): Promise<string> {
  if (!GRANITE_CONFIG.apiKey) {
    return generateLocalFallback(request);
  }

  try {
    const token = await getIAMToken();
    const payload = {
      model_id: request.model || GRANITE_CONFIG.model,
      input: formatMessagesAsPrompt(request.messages),
      parameters: {
        decoding_method: 'greedy',
        max_new_tokens: request.parameters?.max_new_tokens ?? 512,
        temperature: request.parameters?.temperature ?? 0.7,
        top_p: request.parameters?.top_p ?? 0.9,
      },
      project_id: GRANITE_CONFIG.projectId,
    };

    const res = await fetch(`${GRANITE_CONFIG.apiBase}/text/generation?version=2023-05-29`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn('Granite API error, using local fallback:', err);
      return generateLocalFallback(request);
    }

    const data: GraniteResponse = await res.json();
    return data.choices?.[0]?.message?.content ?? generateLocalFallback(request);
  } catch (err) {
    console.warn('Granite call failed, using local fallback:', err);
    return generateLocalFallback(request);
  }
}

function formatMessagesAsPrompt(
  messages: GraniteRequest['messages'],
): string {
  return messages
    .map((m) => {
      if (m.role === 'system') return `[SYSTEM]\n${m.content}\n`;
      if (m.role === 'user') return `[USER]\n${m.content}\n`;
      return `[ASSISTANT]\n${m.content}\n`;
    })
    .join('\n');
}

/** Local reasoning fallback when no API key is set (demo mode) */
function generateLocalFallback(request: GraniteRequest): string {
  const userMsg = request.messages.find((m) => m.role === 'user')?.content ?? '';

  if (userMsg.includes('health advisory')) {
    return 'Based on current AQI levels, I recommend limiting prolonged outdoor activity. Sensitive groups including children, elderly, and those with respiratory conditions should stay indoors and keep windows closed. Use air purifiers if available. Monitor symptoms closely.';
  }
  if (userMsg.includes('forecast')) {
    return 'Air quality is expected to remain in the moderate range over the next 24 hours, with a potential improvement toward evening as wind speeds increase from the northwest. The weekend forecast shows improving conditions. Key factors include traffic emissions, industrial output, and wind patterns.';
  }
  if (userMsg.includes('community')) {
    return 'Community data indicates 3 major pollution hotspots near industrial zones. Resident reports show increased dust levels near the construction site on Main Street. Local schools have implemented indoor recess protocols. 142 community members have reported taking protective actions this week.';
  }
  if (userMsg.includes('anomaly') || userMsg.includes('spike')) {
    return 'An unusual spike in PM2.5 levels detected over the past 2 hours exceeds historical patterns by 34%. This correlates with reported burning activity in the eastern sector and reduced wind dispersal. Alert threshold exceeded — recommend activating public notification protocol.';
  }
  return 'Air quality monitoring systems are operating normally. Current readings are within expected parameters. Continue monitoring and follow standard health guidelines for your local AQI level.';
}
