"""Exploitation : import/export, invitations patient, pièces, tâches, messages, paramètres, droits, conservation."""
from __future__ import annotations

import csv
import datetime as dt
import hashlib
import io
import secrets
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import compliance, intake, messaging, storage, views
from app import models as m
from app import services as svc
from app.core import Principal, current_principal, get_db, get_settings, require_roles, today
from app.templates_msg import render

router = APIRouter()
Coord = Depends(require_roles("admin", "coordinator"))
Admin = Depends(require_roles("admin"))
Staff = Depends(require_roles("admin", "coordinator", "designer", "viewer"))


def _csv_response(rows: list[list], header: list[str], name: str) -> Response:
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")  # le séparateur « ; » s'ouvre correctement dans Excel configuré en français
    w.writerow(header)
    w.writerows(rows)
    return Response("﻿" + buf.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="{name}"'})


# ------------------------------------------------------------------ import / export
@router.post("/journeys/import")
async def import_journeys(file: UploadFile = File(...), dry_run: bool = Form(False), p: Principal = Coord, db: Session = Depends(get_db)):
    raw = await file.read()
    if len(raw) > 2 * 1024 * 1024:
        raise HTTPException(413, "Fichier CSV trop volumineux (max 2 Mo)")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("cp1252", errors="replace")  # exports Excel français
    res = intake.import_csv(db, p, text, dry_run=dry_run)
    if not dry_run:
        svc.audit(db, p, "journey.import", "patient_journey", "csv", created=res["created"], errors=len(res["errors"]))
        db.commit()
    else:
        db.rollback()
    return res


@router.get("/journeys/export.csv")
def export_journeys(p: Principal = Coord, db: Session = Depends(get_db)):
    data = views.journey_list(db, p.establishment_id)
    svc.audit(db, p, "journey.export", "patient_journey", "csv", rows=len(data["items"]))
    db.commit()
    return _csv_response([[r["reference"], r["patient_name"], r["procedure"], r["surgery_date"], r["stage"], r["progress"], r["state_label"], r["owner"]]
                          for r in data["items"]], ["reference", "patient", "intervention", "date", "etape", "progression_pct", "statut", "responsable"],
                         f"parcours-{today().isoformat()}.csv")


@router.get("/audit/export.csv")
def export_audit(p: Principal = Admin, db: Session = Depends(get_db)):
    rows = db.scalars(select(m.AuditLog).where(m.AuditLog.establishment_id == p.establishment_id).order_by(m.AuditLog.at.desc()).limit(5000)).all()
    return _csv_response([[r.at.isoformat(), r.detail.get("actor_label", r.actor), r.action, r.entity, r.entity_id] for r in rows],
                         ["date", "acteur", "action", "objet", "id"], f"journal-audit-{today().isoformat()}.csv")


# ------------------------------------------------------------------ lien patient sécurisé
@router.post("/journeys/{journey_id}/invite")
def invite_patient(journey_id: uuid.UUID, p: Principal = Coord, db: Session = Depends(get_db)):
    j = svc.get_scoped(db, m.PatientJourney, journey_id, p)
    pat = db.get(m.Patient, j.patient_id)
    if not pat.birth_date:
        raise HTTPException(422, "La date de naissance du patient est requise (elle sert de seconde vérification)")
    if pat.anonymized_at:
        raise HTTPException(409, "Patient archivé")
    s = get_settings()
    token = secrets.token_urlsafe(24)
    db.add(m.Invitation(establishment_id=p.establishment_id, patient_id=pat.id, journey_id=j.id,
                        token_hash=hashlib.sha256(token.encode()).hexdigest(),
                        expires_at=dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=s.invitation_hours)))
    link = f"{s.public_web_url.rstrip('/')}/p/{token}"
    est = db.get(m.Establishment, p.establishment_id)
    msg = render("invitation", pat.language, first_name=pat.first_name, clinic=est.name, date=j.surgery_date.strftime("%d/%m/%Y"),
                 hours=s.invitation_hours, link=link)
    row = messaging.send_to_patient(db, p.establishment_id, pat, j.id, "invitation", msg["subject"], msg["body"])
    svc.audit(db, p, "patient.invite", "patient_journey", j.id, journey_id=str(j.id), status=row.status)
    db.commit()
    out = {"status": row.status, "channel": row.channel, "to": row.to_masked, "error": row.error}
    if s.env in ("dev", "test") or row.status != "sent":
        out["link"] = link  # en dev ou si l'envoi n'a pas eu lieu, la coordinatrice peut transmettre le lien elle-même
    return out


# ------------------------------------------------------------------ pièces
@router.get("/documents/{doc_id}/download")
def download_document(doc_id: uuid.UUID, p: Principal = Coord, db: Session = Depends(get_db)):
    doc = svc.get_scoped(db, m.Document, doc_id, p)
    data = storage.read_file(db, doc)
    svc.audit(db, p, "document.download", "document", doc.id, journey_id=str(doc.journey_id), title=doc.filename)
    db.commit()
    return Response(data, media_type=doc.content_type, headers={"Content-Disposition": f'attachment; filename="{doc.filename}"',
                                                                 "Cache-Control": "no-store"})


class RejectIn(BaseModel):
    reason: str = ""


@router.post("/tasks/{task_id}/reject")
def reject_document(task_id: uuid.UUID, body: RejectIn, p: Principal = Coord, db: Session = Depends(get_db)):
    t = svc.get_scoped(db, m.Task, task_id, p)
    if t.status != "submitted":
        raise HTTPException(409, "Seule une pièce en revue peut être redemandée")
    t.status, t.response = "todo", None
    t.detail = body.reason[:500]
    svc.audit(db, p, "task.reject", "task", t.id, journey_id=str(t.journey_id), title=t.title, reason=body.reason[:200])
    db.commit()
    return {"id": str(t.id), "status": t.status}


# ------------------------------------------------------------------ tâches, messages
@router.get("/tasks")
def open_tasks(p: Principal = Staff, db: Session = Depends(get_db)):
    t0 = today()
    out = []
    for j in db.scalars(select(m.PatientJourney).where(m.PatientJourney.establishment_id == p.establishment_id, m.PatientJourney.status == "active")):
        pat = db.get(m.Patient, j.patient_id)
        for t in j.tasks:
            if t.status != "done" and t.due_date <= t0 + dt.timedelta(days=7):
                out.append({"id": str(t.id), "journey_id": str(j.id), "patient_name": f"{pat.first_name} {pat.last_name}", "title": t.title,
                            "kind": t.kind, "status": t.status, "due_date": t.due_date.isoformat(), "days_late": max((t0 - t.due_date).days, 0),
                            "blocking": t.blocking, "owner": t.owner or j.owner})
    out.sort(key=lambda r: (not r["blocking"], -r["days_late"], r["due_date"]))
    return out


@router.get("/messages")
def list_messages(p: Principal = Staff, db: Session = Depends(get_db)):
    rows = db.scalars(select(m.MessageLog).where(m.MessageLog.establishment_id == p.establishment_id).order_by(m.MessageLog.created_at.desc()).limit(100)).all()
    out = []
    for r in rows:
        pat = db.get(m.Patient, r.patient_id) if r.patient_id else None
        out.append({"id": str(r.id), "at": r.created_at.isoformat(), "kind": r.kind, "channel": r.channel, "to": r.to_masked, "status": r.status,
                    "error": r.error, "subject": r.subject, "journey_id": str(r.journey_id) if r.journey_id else None,
                    "patient_name": f"{pat.first_name} {pat.last_name}" if pat else ""})
    return out


# ------------------------------------------------------------------ paramètres et conformité
class SettingsIn(BaseModel):
    city: str = ""
    cndp_ref: str = ""
    cndp_transfer_ref: str = ""
    dpo_contact: str = ""
    retention_days: int = 365
    ai_enabled: bool = True


@router.get("/settings")
def get_settings_route(p: Principal = Admin, db: Session = Depends(get_db)):
    est = db.get(m.Establishment, p.establishment_id)
    enabled, reason = svc.ai_status(est)
    return {"name": est.name, "city": est.city, "cndp_ref": est.cndp_ref, "cndp_transfer_ref": est.cndp_transfer_ref,
            "dpo_contact": est.dpo_contact, "retention_days": est.retention_days, "ai_enabled": est.ai_enabled,
            "ai_effective": enabled, "ai_blocked_reason": reason, "notice_version": compliance.NOTICE_VERSION,
            "messaging_provider": get_settings().messaging_provider, "demo_mode": get_settings().demo_mode}


@router.put("/settings")
def put_settings(body: SettingsIn, p: Principal = Admin, db: Session = Depends(get_db)):
    if not 30 <= body.retention_days <= 3650:
        raise HTTPException(422, "Durée de conservation : entre 30 et 3650 jours")
    est = db.get(m.Establishment, p.establishment_id)
    for k, v in body.model_dump().items():
        setattr(est, k, v.strip() if isinstance(v, str) else v)
    svc.audit(db, p, "settings.update", "establishment", est.id, ai_enabled=est.ai_enabled, retention_days=est.retention_days,
              cndp_ref_set=bool(est.cndp_ref), transfer_ref_set=bool(est.cndp_transfer_ref))
    db.commit()
    return get_settings_route(p, db)


@router.get("/data-requests")
def list_data_requests(p: Principal = Coord, db: Session = Depends(get_db)):
    rows = db.scalars(select(m.DataRequest).where(m.DataRequest.establishment_id == p.establishment_id).order_by(m.DataRequest.created_at.desc())).all()
    out = []
    for r in rows:
        pat = db.get(m.Patient, r.patient_id)
        out.append({"id": str(r.id), "kind": r.kind, "message": r.message, "status": r.status, "resolution": r.resolution, "created_at": r.created_at.isoformat(),
                    "patient_id": str(r.patient_id), "patient_name": f"{pat.first_name} {pat.last_name}"})
    return out


class ResolveIn(BaseModel):
    status: str  # done | rejected
    resolution: str = ""
    anonymize: bool = False  # suppression : exécuter l'anonymisation


@router.post("/data-requests/{req_id}/resolve")
def resolve_data_request(req_id: uuid.UUID, body: ResolveIn, p: Principal = Coord, db: Session = Depends(get_db)):
    r = svc.get_scoped(db, m.DataRequest, req_id, p)
    if r.status != "open" or body.status not in ("done", "rejected"):
        raise HTTPException(409, "Demande déjà traitée ou statut invalide")
    if body.anonymize:
        if "admin" not in p.roles:
            raise HTTPException(403, "Seul un administrateur peut effacer les données d'un patient")
        compliance.anonymize_patient(db, db.get(m.Patient, r.patient_id))
    r.status, r.resolution, r.resolved_by, r.resolved_at = body.status, body.resolution[:1000], p.name or p.sub, dt.datetime.now(dt.timezone.utc)
    svc.audit(db, p, "rights.resolve", "data_request", r.id, kind=r.kind, status=r.status, anonymized=body.anonymize)
    db.commit()
    return {"id": str(r.id), "status": r.status}


@router.post("/admin/purge")
def purge(dry_run: bool = True, p: Principal = Admin, db: Session = Depends(get_db)):
    n = compliance.purge_expired(db, est_id=p.establishment_id, dry_run=dry_run)
    if not dry_run:
        svc.audit(db, p, "retention.purge", "establishment", p.establishment_id, anonymized=n)
    db.commit()
    return {"patients": n, "dry_run": dry_run}


@router.post("/admin/run-reminders")
def run_reminders(p: Principal = Coord, db: Session = Depends(get_db)):
    n = svc.generate_reminder_proposals(db, p.establishment_id)
    if n:
        svc.audit(db, p, "reminders.generate", "establishment", p.establishment_id, proposals=n)
    db.commit()
    return {"proposals": n}


@router.post("/admin/demo-reset")
def demo_reset(p: Principal = Admin, db: Session = Depends(get_db)):
    """Remet les données fictives de démonstration à leur état initial. Désactivé hors DEMO_MODE."""
    if not get_settings().demo_mode:
        raise HTTPException(404, "Introuvable")
    import os
    import seed  # apps/api/seed.py
    os.environ["RESET"] = "1"
    try:
        seed.seed(db)
    finally:
        os.environ.pop("RESET", None)
    return {"ok": True}
