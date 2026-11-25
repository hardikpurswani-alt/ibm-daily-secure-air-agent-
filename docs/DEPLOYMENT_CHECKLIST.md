# AirGuard AI — IBM Cloud & watsonx Orchestrate Deployment Checklist

## Pre-Deployment Verification
- [ ] All backend unit & live integration tests pass (`cd backend && .venv/bin/pytest -v`).
- [ ] Frontend compiles cleanly with zero TypeScript errors (`npm run build`) and passes lint (`npm run lint`).
- [ ] `.env` secrets are stored in IBM Cloud Secrets / environment variables only—never committed to Git.

## 1. IBM Cloud Database (Optional Production PostgreSQL)
- [ ] Provision **IBM Cloud Databases for PostgreSQL** (or attach managed PostgreSQL URI).
- [ ] Set `DATABASE_URL=postgresql+psycopg://<user>:<password>@<host>:<port>/<db>?sslmode=require`.

## 2. IBM watsonx.ai (IBM Granite)
- [ ] Create/open your `au-syd` IBM watsonx.ai project (`https://au-syd.dataplatform.cloud.ibm.com/`).
- [ ] Set `WATSONX_AI_URL=https://au-syd.ml.cloud.ibm.com`, `WATSONX_PROJECT_ID`, and `WATSONX_AI_API_KEY` (or `IBM_CLOUD_API_KEY`).
- [ ] Verify model `ibm/granite-3-8b-instruct` and embedding model `ibm/slate-125m-english-rtrvr` availability in `au-syd`.

## 3. Deploy FastAPI Backend (IBM Cloud Code Engine)
- [ ] Build & push `deploy/Dockerfile.backend` from `backend/` context to IBM Cloud Container Registry (`icr.io`).
- [ ] Create Code Engine secret `airguard-backend-secrets` with `APP_SECRET_KEY`, `DATABASE_URL`, `IBM_CLOUD_API_KEY`, `WATSONX_PROJECT_ID`, `WATSONX_ORCHESTRATE_INSTANCE_URL`, `WATSONX_ORCHESTRATE_API_KEY`, and optional `WAQI_API_TOKEN` / `OPENAQ_API_KEY`.
- [ ] Deploy application (`deploy/code-engine.yaml`) and record the HTTPS URL as `PUBLIC_BACKEND_URL`.
- [ ] Verify `GET https://<PUBLIC_BACKEND_URL>/api/v1/health`.

## 4. Connect Existing watsonx Orchestrate Main Coordinator (`9804aee5-5298-40dc-930c-46d17a839fde`)
- [ ] Retrieve your **Service instance URL** (`https://api.au-syd.watson-orchestrate.cloud.ibm.com/instances/<TENANT_ID>`) from **Profile > Settings > API details**.
- [ ] Run `python3 orchestrate/scripts/sync_orchestrate.py` to inspect `9804aee5-5298-40dc-930c-46d17a839fde` and resolve `PUBLIC_BACKEND_URL` in OpenAPI tools.
- [ ] Import tools (`orchestrate tools import -k openapi -f orchestrate/openapi/airguard_tools.resolved.openapi.yaml`).
- [ ] Import the 4 specialist agents (`orchestrate/agents/*.yaml`).
- [ ] Attach all 4 specialist agents as Collaborators on existing main agent `9804aee5-5298-40dc-930c-46d17a839fde` and deploy.
- [ ] Verify `GET https://<PUBLIC_BACKEND_URL>/api/v1/orchestrate/inspect-coordinator` returns `"connected": true`.

## 5. Deploy Frontend (IBM Cloud Code Engine / Object Storage + CDN)
- [ ] Set `VITE_API_BASE_URL=https://<PUBLIC_BACKEND_URL>` and build (`npm run build`) or deploy `deploy/Dockerfile.frontend`.
- [ ] Add deployed frontend URL to `CORS_ORIGINS` in backend environment variables.
