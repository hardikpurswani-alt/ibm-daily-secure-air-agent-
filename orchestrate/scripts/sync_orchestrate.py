#!/usr/bin/env python3
"""Inspect existing watsonx Orchestrate coordinator (9804aee5-5298-40dc-930c-46d17a839fde)
and attach the 4 specialist collaborator agents + OpenAPI tools without duplicating the main agent.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import httpx

EXISTING_AGENT_ID = os.getenv("WATSONX_ORCHESTRATE_AGENT_ID", "9804aee5-5298-40dc-930c-46d17a839fde")
INSTANCE_URL = os.getenv("WATSONX_ORCHESTRATE_INSTANCE_URL", "").strip().rstrip("/")
API_KEY = (os.getenv("WATSONX_ORCHESTRATE_API_KEY") or os.getenv("IBM_CLOUD_API_KEY") or "").strip()
PUBLIC_BACKEND_URL = os.getenv("PUBLIC_BACKEND_URL", "").strip().rstrip("/")


def get_iam_token(api_key: str) -> str:
    resp = httpx.post(
        "https://iam.cloud.ibm.com/identity/token",
        headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"},
        data={"grant_type": "urn:ibm:params:oauth:grant-type:apikey", "apikey": api_key},
        timeout=15.0,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def main() -> int:
    if not INSTANCE_URL or "/build/agent/edit/" in INSTANCE_URL:
        print(
            "ERROR: Set WATSONX_ORCHESTRATE_INSTANCE_URL to your Service Instance URL "
            "(https://api.au-syd.watson-orchestrate.cloud.ibm.com/instances/<TENANT_ID>), "
            "NOT the browser editor URL.",
            file=sys.stderr,
        )
        return 1
    if not API_KEY:
        print("ERROR: Set WATSONX_ORCHESTRATE_API_KEY or IBM_CLOUD_API_KEY.", file=sys.stderr)
        return 1

    token = get_iam_token(API_KEY)
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}

    print(f"Inspecting existing coordinator agent {EXISTING_AGENT_ID} at {INSTANCE_URL} ...")
    resp = httpx.get(f"{INSTANCE_URL}/v1/orchestrate/agents/{EXISTING_AGENT_ID}", headers=headers, timeout=20.0)
    print(f"HTTP {resp.status_code}")
    if resp.status_code != 200:
        print(resp.text)
        return 1

    agent_data = resp.json()
    print(json.dumps({
        "id": agent_data.get("id"),
        "name": agent_data.get("name"),
        "display_name": agent_data.get("display_name"),
        "collaborators": agent_data.get("collaborators", []),
        "tools": agent_data.get("tools", []),
    }, indent=2))

    # Render OpenAPI spec with live PUBLIC_BACKEND_URL if provided
    root = Path(__file__).resolve().parents[1]
    spec_in = (root / "openapi" / "airguard_tools.openapi.yaml").read_text(encoding="utf-8")
    if PUBLIC_BACKEND_URL:
        out_spec = root / "openapi" / "airguard_tools.resolved.openapi.yaml"
        out_spec.write_text(
            spec_in.replace("https://REPLACE_WITH_YOUR_IBM_CLOUD_CODE_ENGINE_URL", PUBLIC_BACKEND_URL),
            encoding="utf-8",
        )
        print(f"\nResolved OpenAPI spec written to: {out_spec}")

    print("\nNext ADK commands (using `ibm-watsonx-orchestrate` CLI):")
    print(f"  orchestrate env add -n wxo-ausyd -u {INSTANCE_URL} --type ibm_iam --activate")
    print("  orchestrate tools import -k openapi -f orchestrate/openapi/airguard_tools.resolved.openapi.yaml")
    for agent_yaml in sorted((root / "agents").glob("*.yaml")):
        print(f"  orchestrate agents import -f orchestrate/agents/{agent_yaml.name}")
    print(
        f"\nThen open {EXISTING_AGENT_ID} in watsonx Orchestrate Agent Builder and attach the 4 imported "
        "specialist agents under Collaborators (see orchestrate/agents/coordinator_collaborator_config.json)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
