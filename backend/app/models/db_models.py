"""Relational database models for AirGuard AI."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def gen_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    """Registered user account for authenticated preferences and alerts."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class UserPreference(Base):
    """Privacy-conscious user or guest air quality and health preferences."""

    __tablename__ = "user_preferences"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    owner_key: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    default_city: Mapped[str] = mapped_column(String(120), default="Delhi")
    saved_cities_json: Mapped[str] = mapped_column(Text, default='["Delhi", "Sydney", "New York"]')
    aqi_standard: Mapped[str] = mapped_column(String(32), default="us_epa")
    theme_preference: Mapped[str] = mapped_column(String(16), default="system")
    alert_aqi_threshold: Mapped[int] = mapped_column(Integer, default=100)
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    location_consent_granted: Mapped[bool] = mapped_column(Boolean, default=False)
    location_consent_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Optional & removable health profile fields
    age_group: Mapped[str | None] = mapped_column(String(32), nullable=True)
    outdoor_activity: Mapped[str | None] = mapped_column(String(32), nullable=True)
    health_considerations_json: Mapped[str] = mapped_column(Text, default="[]")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class AQISnapshot(Base):
    """Cached telemetry snapshot preserving exact source attribution & provenance."""

    __tablename__ = "aqi_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    city: Mapped[str] = mapped_column(String(120), index=True, nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    aqi: Mapped[int] = mapped_column(Integer, nullable=False)
    aqi_scale: Mapped[str] = mapped_column(String(32), nullable=False)
    observation_type: Mapped[str] = mapped_column(String(48), nullable=False)
    source_name: Mapped[str] = mapped_column(String(180), nullable=False)
    observed_at: Mapped[str] = mapped_column(String(64), nullable=False)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AlertRecord(Base):
    """Persisted predictive and real-time air quality alerts."""

    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    owner_key: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    city: Mapped[str] = mapped_column(String(120), nullable=False)
    severity: Mapped[str] = mapped_column(String(24), nullable=False)
    category: Mapped[str] = mapped_column(String(48), nullable=False)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    agent_source: Mapped[str] = mapped_column(String(64), nullable=False)
    time_window: Mapped[str] = mapped_column(String(80), default="Now")
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    dismissed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class CommunityPledge(Base):
    """Persisted community action pledges (real database state, not random numbers)."""

    __tablename__ = "community_pledges"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    action_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    owner_key: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    city: Mapped[str] = mapped_column(String(120), nullable=False)
    note: Mapped[str | None] = mapped_column(String(280), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PollutionReport(Base):
    """User-submitted local pollution observation (e.g. burning, road dust)."""

    __tablename__ = "pollution_reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    owner_key: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    city: Mapped[str] = mapped_column(String(120), index=True, nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ChatSession(Base):
    """Conversation thread with the AI Air Quality Coordinator."""

    __tablename__ = "chat_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    owner_key: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    city: Mapped[str] = mapped_column(String(120), nullable=False)
    title: Mapped[str] = mapped_column(String(180), default="Air Quality Consultation")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at",
    )


class ChatMessage(Base):
    """Message within a chat session including agent trace & RAG source citations."""

    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    session_id: Mapped[str] = mapped_column(ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(24), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    trace_json: Mapped[str] = mapped_column(Text, default="[]")
    citations_json: Mapped[str] = mapped_column(Text, default="[]")
    coordinator_mode: Mapped[str] = mapped_column(String(64), default="local_multi_agent")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    session: Mapped[ChatSession] = relationship(back_populates="messages")
