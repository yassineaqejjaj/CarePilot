"""Portail patient. Le patient ne voit que SES parcours ; il soumet des pièces mais ne valide jamais lui-même une tâche
(statut `submitted` -> `done` par un coordinateur). Accès par lien sécurisé (jeton à hash + date de naissance) ou Keycloak."""
from __future__ import annotations

import datetime as dt
import hashlib
import uuid

import jwt
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import compliance, storage
from app import models as m
from app import services as svc
from app.core import PORTAL_ISSUER, Principal, get_db, get_settings, require_roles
from app.moroccan import parse_birth_date

router = APIRouter(prefix="/portal")
PatientDep = Depends(require_roles("patient"))
GENERIC_DENIAL = "Lien invalide, expiré, ou date de naissance incorrecte"


def _patient(p: Principal, db: Session) -> m.Patient:
    if p.patient_id is None:
        raise HTTPException(403, "Compte patient non rattaché")
    pat = svc.get_scoped(db, m.Patient, p.patient_id, p)
    if pat.anonymized_at:
        raise HTTPException(410, "Dossier archivé")
    return pat


def _need_consent(db: Session, pat: m.Patient) -> None:
    if not compliance.has_consent(db, pat.id):
        raise HTTPException(403, "consent_required")


# ------------------------------------------------------------------ ouverture de session par lien sécurisé
class SessionIn(BaseModel):
    token: str
    birth_date: str  # JJ/MM/AAAA ou AAAA-MM-JJ


@router.post("/session")
def open_session(body: SessionIn, db: Session = Depends(get_db)):
    """Échange (jeton du lien + date de naissance) contre une session courte. Même réponse pour tout échec (pas d'oracle),
    compteur d'essais par lien, verrouillage après `invitation_max_attempts` erreurs."""
    s = get_settings()
    inv = db.scalar(select(m.Invitation).where(m.Invitation.token_hash == hashlib.sha256(body.token.encode()).hexdigest()))
    now = dt.datetime.now(dt.timezone.utc)
    if inv is None:
        raise HTTPException(401, GENERIC_DENIAL)
    exp = inv.expires_at if inv.expires_at.tzinfo else inv.expires_at.replace(tzinfo=dt.timezone.utc)
    pat = db.get(m.Patient, inv.patient_id)
    if exp < now or inv.attempts >= s.invitation_max_attempts or pat is None or pat.anonymized_at or pat.birth_date is None:
        raise HTTPException(401, GENERIC_DENIAL)
    given = parse_birth_date(body.birth_date)
    if given != pat.birth_date:
        inv.attempts += 1
        db.commit()
        raise HTTPException(401, GENERIC_DENIAL)
    inv.attempts = 0
    db.add(m.AuditLog(establishment_id=inv.establishment_id, actor=f"patient:{pat.id}", action="portal.login", entity="patient",
                      entity_id=str(pat.id), detail={"journey_id": str(inv.journey_id), "actor_label": f"{pat.first_name} {pat.last_name}"}))
    db.commit()
    tok = jwt.encode({"sub": f"patient:{pat.id}", "establishment_id": str(pat.establishment_id), "patient_id": str(pat.id),
                      "name": f"{pat.first_name} {pat.last_name}", "iss": PORTAL_ISSUER, "aud": s.oidc_audience,
                      "iat": now, "exp": now + dt.timedelta(hours=s.patient_session_hours)}, s.patient_session_secret, algorithm="HS256")
    return {"access_token": tok, "expires_in": s.patient_session_hours * 3600, "first_name": pat.first_name, "language": pat.language}


# ------------------------------------------------------------------ lecture
@router.get("/me")
def me(p: Principal = PatientDep, db: Session = Depends(get_db)):
    pat = _patient(p, db)
    est = db.get(m.Establishment, p.establishment_id)
    consented = compliance.has_consent(db, pat.id)
    preferences = db.get(m.FacilityPreferences,p.establishment_id)
    journeys = db.scalars(select(m.PatientJourney).where(
        m.PatientJourney.patient_id == pat.id, m.PatientJourney.establishment_id == p.establishment_id)).all()
    out = []
    for j in journeys:
        msgs = db.scalars(select(m.AIProposal).where(m.AIProposal.journey_id == j.id, m.AIProposal.kind == "message_draft",
                                                      m.AIProposal.status == "approved")).all()  # uniquement des messages validés par un humain
        visible = [t for t in sorted(j.tasks, key=lambda t: t.due_date)
                   if t.kind in ("document", "questionnaire") or t.title == "Informations pratiques"]
        done = sum(t.status == "done" for t in visible)
        out.append({
            "journey_id": str(j.id), "surgery_date": j.surgery_date.isoformat(), "procedure": j.procedure,
            "admission_time": j.admission_time, "progress": {"done": done, "total": len(visible)},
            "tasks": [{"id": str(t.id), "title": t.title, "kind": t.kind, "due_date": t.due_date.isoformat(),
                       "reason": t.detail if t.status == "todo" else "", "status": t.status, "can_submit": t.kind in ("document", "questionnaire")} for t in visible],
            "messages": [{"subject": x.payload.get("subject"), "body": x.payload.get("body")} for x in msgs]})
    return {"first_name": pat.first_name, "language": pat.language, "establishment": est.name if est else "",
            "contacts": {"phone":preferences.support_phone if preferences else "", "email":preferences.support_email if preferences else ""},
            "consent_required": not consented, "notice": compliance.notice(est), "journeys": out if consented else []}


class ConsentIn(BaseModel):
    accept: bool


@router.post("/consent")
def consent(body: ConsentIn, p: Principal = PatientDep, db: Session = Depends(get_db)):
    pat = _patient(p, db)
    if not body.accept:
        raise HTTPException(422, "Sans votre accord, vous pouvez contacter directement le service des admissions")
    if not compliance.has_consent(db, pat.id):
        compliance.record_consent(db, p.establishment_id, pat.id)
        svc.audit(db, p, "consent.given", "patient", pat.id, version=compliance.NOTICE_VERSION)
        db.commit()
    return {"ok": True}


# ------------------------------------------------------------------ dépôt de pièces
def _own_task(db: Session, p: Principal, pat: m.Patient, task_id: uuid.UUID) -> m.Task:
    t = svc.get_scoped(db, m.Task, task_id, p)
    if t.journey.patient_id != pat.id or t.kind not in ("document", "questionnaire"):
        raise HTTPException(404, "Introuvable")
    if t.status != "todo":
        raise HTTPException(409, "Déjà soumis")
    return t


class SubmitIn(BaseModel):
    response: dict = {}


@router.post("/tasks/{task_id}/submit")
def submit(task_id: uuid.UUID, body: SubmitIn, p: Principal = PatientDep, db: Session = Depends(get_db)):
    pat = _patient(p, db)
    _need_consent(db, pat)
    t = _own_task(db, p, pat, task_id)
    t.status, t.response = "submitted", body.response
    svc.audit(db, p, "portal.submit", "task", t.id, kind=t.kind, journey_id=str(t.journey_id), title=t.title)  # le contenu n'est pas journalisé
    db.commit()
    return {"id": str(t.id), "status": t.status}


@router.post("/tasks/{task_id}/upload")
async def upload(task_id: uuid.UUID, file: UploadFile = File(...), p: Principal = PatientDep, db: Session = Depends(get_db)):
    pat = _patient(p, db)
    _need_consent(db, pat)
    t = _own_task(db, p, pat, task_id)
    data = await file.read(get_settings().max_upload_mb * 1024 * 1024 + 1)
    doc = storage.save_upload(db, p.establishment_id, t.journey_id, t.id, file.filename or "document", data, "patient")
    t.status = "submitted"
    db.flush()
    svc.audit(db, p, "portal.upload", "document", doc.id, journey_id=str(t.journey_id), title=t.title, size=doc.size)
    db.commit()
    return {"id": str(t.id), "status": t.status, "document_id": str(doc.id)}


# ------------------------------------------------------------------ droits des personnes (loi 09-08)
@router.get("/my-data")
def my_data(p: Principal = PatientDep, db: Session = Depends(get_db)):
    pat = _patient(p, db)
    svc.audit(db, p, "rights.access_export", "patient", pat.id)
    db.commit()
    return compliance.export_patient_data(db, pat)


class RightsIn(BaseModel):
    kind: str  # rectification | opposition | deletion | access
    message: str = ""


@router.post("/rights", status_code=201)
def rights(body: RightsIn, p: Principal = PatientDep, db: Session = Depends(get_db)):
    pat = _patient(p, db)
    if body.kind not in ("access", "rectification", "opposition", "deletion"):
        raise HTTPException(422, "Type de demande inconnu")
    r = m.DataRequest(establishment_id=p.establishment_id, patient_id=pat.id, kind=body.kind, message=body.message[:1000])
    db.add(r)
    db.flush()
    svc.audit(db, p, "rights.request", "data_request", r.id, kind=body.kind)
    db.commit()
    return {"id": str(r.id), "status": r.status}
