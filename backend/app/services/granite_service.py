"""IBM Granite 3 service via IBM watsonx.ai SDK & REST API."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from ..core.config import get_settings

logger = logging.getLogger("airguard.granite")


class GraniteService:
    """Calls IBM Granite models in watsonx.ai with structured JSON and safe fallback reporting."""

    def _get_model(self, max_tokens: int = 450, temperature: float = 0.25):
        settings = get_settings()
        if not settings.is_granite_configured:
            return None

        from ibm_watsonx_ai import APIClient, Credentials
        from ibm_watsonx_ai.foundation_models import ModelInference
        from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as GenParams

        credentials = Credentials(
            url=settings.watsonx_ai_url,
            api_key=settings.effective_watsonx_ai_key,
        )
        client = APIClient(credentials=credentials, project_id=settings.watsonx_project_id)
        params = {
            GenParams.DECODING_METHOD: "greedy" if temperature <= 0.2 else "sample",
            GenParams.MAX_NEW_TOKENS: max_tokens,
            GenParams.TEMPERATURE: temperature,
        }
        return ModelInference(
            model_id=settings.watsonx_granite_model_id,
            api_client=client,
            project_id=settings.watsonx_project_id,
            params=params,
        )

    def chat(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 450,
        temperature: float = 0.25,
    ) -> Tuple[Optional[str], Optional[str]]:
        """Invoke IBM Granite chat inference; returns (text, error_message)."""
        settings = get_settings()
        if not settings.is_granite_configured:
            return None, "IBM watsonx.ai credentials (WATSONX_AI_API_KEY / WATSONX_PROJECT_ID) are not configured."

        try:
            model = self._get_model(max_tokens=max_tokens, temperature=temperature)
            if model is None:
                return None, "Unable to initialize IBM Granite ModelInference."
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ]
            response = model.chat(messages=messages)
            content = (
                response.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )
            if not content:
                return None, "IBM Granite returned an empty response."
            return content, None
        except Exception as exc:  # noqa: BLE001
            logger.warning("IBM Granite chat failed: %s", exc)
            return None, f"IBM Granite invocation failed: {exc}"

    def structured_json(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 550,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Invoke IBM Granite requesting strict JSON output and parse defensively."""
        prompt = (
            f"{user_prompt}\n\n"
            "Respond ONLY with a single valid JSON object. Do not include markdown fences or commentary."
        )
        raw, err = self.chat(system_prompt=system_prompt, user_prompt=prompt, max_tokens=max_tokens, temperature=0.15)
        if not raw:
            return None, err

        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.IGNORECASE | re.DOTALL)
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        candidate = match.group(0) if match else cleaned
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                return parsed, None
            return None, "IBM Granite JSON output was not an object."
        except json.JSONDecodeError as exc:
            return None, f"Failed to parse IBM Granite JSON: {exc}"

    def health_check(self) -> Dict[str, Any]:
        """Report honest watsonx.ai configuration & optional connectivity."""
        settings = get_settings()
        return {
            "configured": settings.is_granite_configured,
            "url": settings.watsonx_ai_url,
            "model_id": settings.watsonx_granite_model_id,
            "project_id_present": bool(settings.watsonx_project_id.strip()),
            "mode": "ibm_watsonx_granite" if settings.is_granite_configured else "unconfigured_evidence_fallback",
        }


granite_service = GraniteService()
