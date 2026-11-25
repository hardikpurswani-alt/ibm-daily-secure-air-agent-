"""IBM watsonx Orchestrate client connecting to the user's existing main coordinator agent."""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx

from ..core.config import get_settings

logger = logging.getLogger("airguard.orchestrate")


class WatsonxOrchestrateClient:
    """Runtime client for IBM watsonx Orchestrate (au-syd existing agent coordinator)."""

    def __init__(self) -> None:
        self._iam_token: Optional[str] = None
        self._iam_expiry: float = 0.0

    async def _get_iam_token(self, api_key: str) -> str:
        if self._iam_token and time.time() < self._iam_expiry:
            return self._iam_token

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://iam.cloud.ibm.com/identity/token",
                headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"},
                data={
                    "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
                    "apikey": api_key,
                },
            )
            resp.raise_for_status()
            payload = resp.json()
            token = payload["access_token"]
            expires_in = int(payload.get("expires_in", 3600))
            self._iam_token = token
            self._iam_expiry = time.time() + max(60, expires_in - 300)
            return token

    async def inspect_existing_coordinator(self) -> Dict[str, Any]:
        """Inspect the existing watsonx Orchestrate main agent configuration via REST API."""
        settings = get_settings()
        base_info = {
            "agent_id": settings.watsonx_orchestrate_agent_id,
            "editor_url": settings.watsonx_orchestrate_editor_url,
            "instance_url_configured": bool(settings.watsonx_orchestrate_instance_url.strip()),
            "api_key_configured": bool(settings.effective_orchestrate_key),
            "connected": False,
        }

        raw_url = settings.watsonx_orchestrate_instance_url.strip().rstrip("/")
        if "/build/agent/edit/" in raw_url:
            return {
                **base_info,
                "error": (
                    "WATSONX_ORCHESTRATE_INSTANCE_URL is set to the browser editor URL. "
                    "Set it to your Service Instance API URL: "
                    "https://api.au-syd.watson-orchestrate.cloud.ibm.com/instances/<TENANT_ID>"
                ),
            }

        if not settings.is_orchestrate_configured:
            return {
                **base_info,
                "error": (
                    "Missing WATSONX_ORCHESTRATE_INSTANCE_URL or WATSONX_ORCHESTRATE_API_KEY. "
                    "Retrieve both from watsonx Orchestrate > Profile > Settings > API details."
                ),
            }

        try:
            token = await self._get_iam_token(settings.effective_orchestrate_key)
            headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(
                    f"{raw_url}/v1/orchestrate/agents/{settings.watsonx_orchestrate_agent_id}",
                    headers=headers,
                )
                if resp.status_code == 200:
                    agent_doc = resp.json()
                    return {
                        **base_info,
                        "connected": True,
                        "instance_url": raw_url,
                        "agent_name": agent_doc.get("name") or agent_doc.get("display_name"),
                        "model": agent_doc.get("llm") or agent_doc.get("model"),
                        "collaborators": agent_doc.get("collaborators", []),
                        "tools": agent_doc.get("tools", []),
                        "raw_summary": {
                            "description": agent_doc.get("description", ""),
                            "style": agent_doc.get("style") or agent_doc.get("agent_style"),
                        },
                    }
                return {
                    **base_info,
                    "instance_url": raw_url,
                    "status_code": resp.status_code,
                    "error": f"Orchestrate inspect returned HTTP {resp.status_code}: {resp.text[:300]}",
                }
        except Exception as exc:  # noqa: BLE001
            return {**base_info, "instance_url": raw_url, "error": f"Orchestrate connection error: {exc}"}

    async def invoke_coordinator_chat(
        self,
        user_message: str,
        grounded_context: str,
        thread_id: Optional[str] = None,
    ) -> Tuple[Optional[str], Optional[str]]:
        """Send a coordinated turn to the existing watsonx Orchestrate agent."""
        settings = get_settings()
        if not settings.is_orchestrate_configured:
            return None, "IBM watsonx Orchestrate runtime instance URL / API key is not configured."

        instance_url = settings.watsonx_orchestrate_instance_url.strip().rstrip("/")
        agent_id = settings.watsonx_orchestrate_agent_id.strip()

        try:
            token = await self._get_iam_token(settings.effective_orchestrate_key)
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
            if thread_id:
                headers["X-IBM-THREAD-ID"] = thread_id

            payload = {
                "stream": False,
                "messages": [
                    {
                        "role": "user",
                        "content": (
                            f"[GROUNDED LIVE AIRGUARD CONTEXT]\n{grounded_context}\n\n"
                            f"[USER QUESTION]\n{user_message}"
                        ),
                    }
                ],
            }

            endpoint = f"{instance_url}/v1/orchestrate/{agent_id}/chat/completions"
            async with httpx.AsyncClient(timeout=45.0) as client:
                resp = await client.post(endpoint, headers=headers, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    reply = (
                        data.get("choices", [{}])[0]
                        .get("message", {})
                        .get("content", "")
                        .strip()
                    )
                    if reply:
                        return reply, None
                    return None, "watsonx Orchestrate returned empty chat content."
                return None, f"watsonx Orchestrate HTTP {resp.status_code}: {resp.text[:300]}"
        except Exception as exc:  # noqa: BLE001
            logger.warning("watsonx Orchestrate invocation failed: %s", exc)
            return None, f"watsonx Orchestrate call failed: {exc}"


orchestrate_client = WatsonxOrchestrateClient()
