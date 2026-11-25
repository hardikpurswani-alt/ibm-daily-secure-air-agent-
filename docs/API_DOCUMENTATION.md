# AirGuard AI — Backend REST & Orchestrate Tool API Documentation

Base URL (local): `http://localhost:8000`
Interactive OpenAPI / Swagger UI: `http://localhost:8000/docs`

---

## 1. Authentication & Privacy Headers
- Optional JWT authentication: `Authorization: Bearer <access_token>`
- Privacy-safe guest session persistence: `X-Session-ID: <uuid>`

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Create user account (PBKDF2-SHA256 hashed password) & return JWT |
| `POST` | `/api/v1/auth/login` | Sign in & return JWT |
| `GET` | `/api/v1/auth/me` | Inspect active user or guest state |
| `GET` | `/api/v1/preferences` | Fetch saved cities, AQI standard, theme, consent, optional health profile |
| `PUT` | `/api/v1/preferences` | Persist updated preferences & consent |
| `DELETE` | `/api/v1/preferences/health` | Erase optional health considerations & profile data |
| `DELETE` | `/api/v1/preferences/location-consent` | Revoke browser geolocation consent |

---

## 2. Live AQI Telemetry & Historical Analytics

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/v1/aqi/live?city=Delhi` | Validated real-time AQI, 8 pollutant species (PM2.5, PM10, CO, NO2, SO2, O3, NH3, Pb status), meteorology, source attribution, and hotspots |
| `GET` | `/api/v1/aqi/historical?city=Delhi&hours=48` | 48–72h hourly time-series & min/max/avg/exceedance stats |
| `GET` | `/api/v1/aqi/search-locations?q=Sydney` | Geocoding city autocomplete via Open-Meteo |

---

## 3. Multi-Agent System & RAG

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/v1/agents/briefing?city=Delhi` | Run Main Coordinator + all 4 specialist agents + RAG + DB snapshot/alert sync |
| `POST` | `/api/v1/agents/health-advisory?city=Delhi` | Run Health Advisory Agent for explicit age/activity/considerations |
| `GET` | `/api/v1/agents/forecast?city=Delhi&horizon_hours=48` | Run Forecasting Agent with uncertainty bands & early warnings |
| `GET` | `/api/v1/agents/community?city=Delhi` | Run Community Action Agent with DB pledges & RAG policies |
| `POST` | `/api/v1/agents/community/pledges` | Toggle persistent community action pledge |
| `POST` | `/api/v1/agents/community/reports` | Log local citizen pollution observation |
| `GET` | `/api/v1/rag/search?q=...` | Query WHO, US EPA, India CPCB/GRAP, CDC, and UNEP documents with citations |
| `GET` | `/api/v1/rag/documents` | List indexed knowledge base sources |

---

## 4. IBM watsonx Orchestrate Coordinator & Assistant

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/v1/orchestrate/chat` | Conversational turn via existing main agent `9804aee5-5298-40dc-930c-46d17a839fde` (or local coordinator fallback) |
| `GET` | `/api/v1/orchestrate/sessions` | List persisted chat threads |
| `GET` | `/api/v1/orchestrate/sessions/{id}` | Fetch conversation history, agent traces, and citations |
| `GET` | `/api/v1/orchestrate/inspect-coordinator` | Live inspection of existing `au-syd` agent configuration |
| `GET` | `/api/v1/system/status` | Honest live status of data sources, RAG, IBM Granite, and watsonx Orchestrate |

---

## 5. OpenAPI 3.0 Tool Endpoints for watsonx Orchestrate Collaborators
- `GET /api/v1/tools/aqi-data` (`operationId: get_live_aqi_data`)
- `GET /api/v1/tools/health-advisory` (`operationId: generate_health_advisory`)
- `GET /api/v1/tools/forecast` (`operationId: get_aqi_forecast`)
- `GET /api/v1/tools/community-action` (`operationId: get_community_actions`)
- `GET /api/v1/tools/rag-lookup` (`operationId: search_environmental_guidelines`)
