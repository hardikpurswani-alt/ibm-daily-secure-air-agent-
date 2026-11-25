"""Alerts & notifications endpoints backed by SQL database."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.security import resolve_owner_key
from ..models.db_models import AlertRecord

router = APIRouter(prefix="/api/v1/alerts", tags=["Alerts"])


@router.get("")
def list_alerts(
    db: Session = Depends(get_db),
    owner_key: str = Depends(resolve_owner_key),
):
    """List active (non-dismissed) predictive and real-time alerts."""
    rows = (
        db.query(AlertRecord)
        .filter(AlertRecord.owner_key == owner_key, AlertRecord.dismissed == False)  # noqa: E712
        .order_by(AlertRecord.created_at.desc())
        .limit(40)
        .all()
    )
    return [
        {
            "id": a.id,
            "city": a.city,
            "severity": a.severity,
            "category": a.category,
            "title": a.title,
            "message": a.message,
            "agent_source": a.agent_source,
            "time_window": a.time_window,
            "read": a.read,
            "created_at": a.created_at.isoformat() if a.created_at else "",
        }
        for a in rows
    ]


@router.post("/{alert_id}/read")
def mark_alert_read(
    alert_id: str,
    db: Session = Depends(get_db),
    owner_key: str = Depends(resolve_owner_key),
):
    row = db.query(AlertRecord).filter(AlertRecord.id == alert_id, AlertRecord.owner_key == owner_key).first()
    if not row:
        raise HTTPException(status_code=404, detail="Alert not found.")
    row.read = True
    db.commit()
    return {"id": row.id, "read": True}


@router.post("/mark-all-read")
def mark_all_alerts_read(
    db: Session = Depends(get_db),
    owner_key: str = Depends(resolve_owner_key),
):
    db.query(AlertRecord).filter(AlertRecord.owner_key == owner_key).update({"read": True})
    db.commit()
    return {"updated": True}


@router.delete("/{alert_id}")
def dismiss_alert(
    alert_id: str,
    db: Session = Depends(get_db),
    owner_key: str = Depends(resolve_owner_key),
):
    row = db.query(AlertRecord).filter(AlertRecord.id == alert_id, AlertRecord.owner_key == owner_key).first()
    if not row:
        raise HTTPException(status_code=404, detail="Alert not found.")
    row.dismissed = True
    db.commit()
    return {"id": row.id, "dismissed": True}
