"""Application configuration loaded securely from environment variables."""

from __future__ import annotations

import secrets
from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
KNOWLEDGE_DIR = Path(__file__).resolve().parents[1] / "knowledge"


class Settings(BaseSettings):
    """Runtime settings for AirGuard AI FastAPI backend."""

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "AirGuard AI — Daily Air Quality Action Agent"
    app_version: str = "1.0.0"
    app_env: str = "development"
    app_secret_key: str = Field(default_factory=lambda: secrets.token_urlsafe(32))
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    rate_limit_per_minute: int = 120

    database_url: str = f"sqlite:///{BACKEND_DIR / 'airguard.db'}"

    # IBM Cloud & watsonx.ai (IBM Granite)
    ibm_cloud_api_key: str = ""
    watsonx_ai_api_key: str = ""
    watsonx_ai_url: str = "https://au-syd.ml.cloud.ibm.com"
    watsonx_project_id: str = ""
    watsonx_granite_model_id: str = "ibm/granite-3-8b-instruct"
    watsonx_embedding_model_id: str = "ibm/slate-125m-english-rtrvr"

    # IBM watsonx Orchestrate (Existing Main Coordinator Agent)
    watsonx_orchestrate_instance_url: str = ""
    watsonx_orchestrate_api_key: str = ""
    watsonx_orchestrate_agent_id: str = "9804aee5-5298-40dc-930c-46d17a839fde"
    watsonx_orchestrate_editor_url: str = (
        "https://au-syd.watson-orchestrate.cloud.ibm.com/build/agent/edit/"
        "9804aee5-5298-40dc-930c-46d17a839fde"
    )

    # Public AQI APIs (optional keys; CPCB India, NSW EPA, Open-Meteo need no key)
    waqi_api_token: str = ""
    openaq_api_key: str = ""
    airnow_api_key: str = ""
    data_gov_in_api_key: str = ""

    public_backend_url: str = "http://localhost:8000"

    @property
    def cors_origin_list(self) -> List[str]:
        """Parse comma-separated CORS origins."""
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def effective_watsonx_ai_key(self) -> str:
        """Return watsonx.ai key or fallback to IBM Cloud API key."""
        return (self.watsonx_ai_api_key or self.ibm_cloud_api_key).strip()

    @property
    def effective_orchestrate_key(self) -> str:
        """Return Orchestrate key or fallback to IBM Cloud API key."""
        return (self.watsonx_orchestrate_api_key or self.ibm_cloud_api_key).strip()

    @property
    def is_granite_configured(self) -> bool:
        """Whether IBM watsonx.ai credentials & project ID are present."""
        return bool(self.effective_watsonx_ai_key and self.watsonx_project_id.strip())

    @property
    def is_orchestrate_configured(self) -> bool:
        """Whether watsonx Orchestrate runtime instance URL & API key are present."""
        url = self.watsonx_orchestrate_instance_url.strip()
        # Explicitly prevent treating the UI editor link as a runtime endpoint
        if not url or "/build/agent/edit/" in url:
            return False
        return bool(self.effective_orchestrate_key and self.watsonx_orchestrate_agent_id.strip())

    @property
    def has_valid_waqi_token(self) -> bool:
        """Reject the WAQI 'demo' token because it returns Shanghai for all queries."""
        token = self.waqi_api_token.strip()
        return bool(token and token.lower() != "demo")


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()
