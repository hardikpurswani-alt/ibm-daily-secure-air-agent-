# IBM watsonx Orchestrate Multi-Agent Integration Guide

This package connects **AirGuard AI** to your **existing** IBM watsonx Orchestrate coordinator agent without creating any duplicate coordinator:

- **Existing Main Coordinator Agent ID:** `9804aee5-5298-40dc-930c-46d17a839fde`
- **Console Editor URL (UI only — never a runtime API endpoint):**
  `https://au-syd.watson-orchestrate.cloud.ibm.com/build/agent/edit/9804aee5-5298-40dc-930c-46d17a839fde`

---

## 1. Prerequisites
1. Deploy or expose the FastAPI backend (`backend/`) at a reachable HTTPS URL (`PUBLIC_BACKEND_URL`, e.g. IBM Cloud Code Engine app URL).
2. In IBM watsonx Orchestrate (`au-syd`), open **Profile > Settings > API details** to retrieve:
   - **Service instance URL** (`https://api.au-syd.watson-orchestrate.cloud.ibm.com/instances/<TENANT_ID>`)
   - **IBM Cloud IAM API key**
3. Store those in `backend/.env` (`WATSONX_ORCHESTRATE_INSTANCE_URL`, `WATSONX_ORCHESTRATE_API_KEY`, `WATSONX_ORCHESTRATE_AGENT_ID=9804aee5-5298-40dc-930c-46d17a839fde`).

---

## 2. Inspect Existing Coordinator & Import Tools / Collaborators

Install the IBM watsonx Orchestrate ADK in a Python 3.12 environment:
```bash
pip install ibm-watsonx-orchestrate
```

Run the included inspection & resolution script:
```bash
export WATSONX_ORCHESTRATE_INSTANCE_URL="https://api.au-syd.watson-orchestrate.cloud.ibm.com/instances/<TENANT_ID>"
export WATSONX_ORCHESTRATE_API_KEY="<YOUR_IBM_CLOUD_API_KEY>"
export PUBLIC_BACKEND_URL="https://<your-code-engine-url>"
python3 orchestrate/scripts/sync_orchestrate.py
```

Then import the OpenAPI tools and four specialist agents:
```bash
orchestrate env add -n wxo-ausyd -u "$WATSONX_ORCHESTRATE_INSTANCE_URL" --type ibm_iam --activate
orchestrate tools import -k openapi -f orchestrate/openapi/airguard_tools.resolved.openapi.yaml
orchestrate agents import -f orchestrate/agents/aqi_data_agent.yaml
orchestrate agents import -f orchestrate/agents/health_advisory_agent.yaml
orchestrate agents import -f orchestrate/agents/forecasting_agent.yaml
orchestrate agents import -f orchestrate/agents/community_action_agent.yaml
```

---

## 3. Attach Collaborators to Your Existing Main Agent
Open `https://au-syd.watson-orchestrate.cloud.ibm.com/build/agent/edit/9804aee5-5298-40dc-930c-46d17a839fde`:
1. Under **Collaborators**, add the four imported specialist agents:
   - `airguard_aqi_data_agent`
   - `airguard_health_advisory_agent`
   - `airguard_forecasting_agent`
   - `airguard_community_action_agent`
2. Optionally update the main agent's instructions using `orchestrate/agents/coordinator_collaborator_config.json`.
3. Click **Deploy** in Agent Builder.
4. Verify live status inside the AirGuard AI dashboard on the **Settings & Diagnostics** page or via `GET /api/v1/orchestrate/inspect-coordinator`.
