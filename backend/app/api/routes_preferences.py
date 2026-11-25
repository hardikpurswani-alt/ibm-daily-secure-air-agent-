"""Privacy-conscious user preference & removable health consideration endpoints."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.security import resolve_owner_key
from ..models.db_models import UserPreference
from ..schemas.airguard import PreferencesPayload

router = APIRouter(prefix="/api/v1/preferences", tags=["Preferences"])


def _get_or_create(db: Session, owner_key: str) -> UserPreference:
    pref = db.query(UserPreference).filter(UserPreference.owner_key == owner_key).first()
    if not pref:
        pref = UserPreference(owner_key=owner_key)
        db.add(pref)
        db.commit()
        db.refresh(pref)
    return pref


def _serialize(pref: UserPreference) -> dict:
    try:
        saved = json.loads(pref.saved_cities_json or "[]")
    except Exception:
        saved = ["Delhi", "Sydney", "New York"]
    try:
        health = json.loads(pref.health_considerations_json or "[]")
    except Exception:
        health = []
    return {
        "default_city": pref.default_city,
        "saved_cities": saved,
        "aqi_standard": pref.aqi_standard,
        "theme_preference": pref.theme_preference,
        "alert_aqi_threshold": pref.alert_aqi_threshold,
        "notifications_enabled": pref.notifications_enabled,
        "location_consent_granted": pref.location_consent_granted,
        "location_consent_updated_at": pref.location_consent_updated_at.isoformat()
        if pref.location_consent_updated_at
        else None,
        "age_group": pref.age_group,
        "outdoor_activity": pref.outdoor_activity,
        "health_considerations": health,
    }


@router.get("")
def get_preferences(
    db: Session = Depends(get_db),
    owner_key: str = Depends(resolve_owner_key),
):
    pref = _get_or_create(db, owner_key)
    return _serialize(pref)


@router.put("")
def update_preferences(
    payload: PreferencesPayload,
    db: Session = Depends(get_db),
    owner_key: str = Depends(resolve_owner_key),
):
    pref = _get_or_create(db, owner_key)
    pref.default_city = payload.default_city.strip()
    pref.saved_cities_json = json.dumps(payload.saved_cities[:12])
    pref.aqi_standard = payload.aqi_standard
    pref.theme_preference = payload.theme_preference
    pref.alert_aqi_threshold = payload.alert_aqi_threshold
    pref.notifications_enabled = payload.notifications_enabled
    if payload.location_consent_granted != pref.location_consent_granted:
        pref.location_consent_granted = payload.location_consent_granted
        pref.location_consent_updated_at = datetime.now(timezone.utc)
    pref.age_group = payload.age_group
    pref.outdoor_activity = payload.outdoor_activity
    pref.health_considerations_json = json.dumps([c.strip() for c in payload.health_considerations if c.strip()][:10])
    db.commit()
    db.refresh(pref)
    return _serialize(pref)


@router.delete("/health")
def clear_health_preferences(
    db: Session = Depends(get_db),
    owner_key: str = Depends(resolve_owner_key),
):
    """Explicitly erase optional health profile & considerations for user privacy."""
    pref = _get_or_create(db, owner_key)
    pref.age_group = None
    pref.outdoor_activity = None
    pref.health_considerations_json = "[]"
    db.commit()
    db.refresh(pref)
    return _serialize(pref)


@router.delete("/location-consent")
def revoke_location_consent(
    db: Session = Depends(get_db),
    owner_key: str = Depends(resolve_owner_key),
):
    """Revoke location permission consent."""
    pref = _get_or_create(db, owner_key)
    pref.location_consent_granted = False
    pref.location_consent_updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(pref)
    return _serialize(pref)
