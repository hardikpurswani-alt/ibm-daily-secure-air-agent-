"""FastAPI application entrypoint for AirGuard AI."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api import (
    routes_agents,
    routes_alerts,
    routes_aqi,
    routes_auth,
    routes_orchestrate,
    routes_preferences,
    routes_rag,
    routes_tools,
)
from .core.config import get_settings
from .core.database import init_db
from .core.security import InMemoryRateLimiter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

settings = get_settings()
rate_limiter = InMemoryRateLimiter(max_requests_per_minute=settings.rate_limit_per_minute)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Backend API, RAG Knowledge System, IBM Granite reasoning, and IBM watsonx Orchestrate "
        "multi-agent integration for the Daily Air Quality Action Agent."
    ),
    lifespan=lifespan,
    servers=[{"url": settings.public_backend_url, "description": "AirGuard AI Backend Server"}],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_and_rate_limit_middleware(request: Request, call_next):
    if request.url.path.startswith("/api/"):
        rate_limiter.check(request)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.exception_handler(HTTPException)
async def standardized_http_exception(_: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": str(exc.detail), "code": f"HTTP_{exc.status_code}", "detail": exc.detail},
    )


@app.exception_handler(Exception)
async def standardized_unexpected_exception(_: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error while processing air quality request.",
            "code": "INTERNAL_ERROR",
            "detail": str(exc) if settings.app_env != "production" else "Unexpected error",
        },
    )


@app.get("/api/v1/health", tags=["Health"])
def health_check():
    """Lightweight health check for IBM Cloud Code Engine & local monitoring."""
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "coordinator_agent_id": settings.watsonx_orchestrate_agent_id,
    }


app.include_router(routes_auth.router)
app.include_router(routes_aqi.router)
app.include_router(routes_agents.router)
app.include_router(routes_orchestrate.router)
app.include_router(routes_alerts.router)
app.include_router(routes_preferences.router)
app.include_router(routes_rag.router)
app.include_router(routes_tools.router)
