"""Établissements, patients fictifs, parcours, tâches, cockpit, analytics, audit."""
from __future__ import annotations

import datetime as dt
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models as m
from app import services as svc
from app import intake, views
from app.core import Principal, current_principal, get_db, require_roles

router = APIRouter()
Coord = Depends(require_roles("admin", "coordinator"))
Any_ = Depends(require_roles("admin", "coordinator", "designer", "viewer"))  # personnel uniquement, jamais le rôle patient


class PatientIn(BaseModel):
    first_name: str
    last_name: str
    email: str = ""
    phone: str = ""
    birth_date: str = ""  # JJ/MM/AAAA ou AAAA-MM-JJ
    language: str = "fr"
    preferred_channel: str = "whatsapp"
    informed: bool = False  # le patient a reçu l'information prévue par l'art. 5 de la loi 09-08


class JourneyIn(BaseModel):
    patient_id: uuid.UUID | None = None
    patient: PatientIn | None = None
    template_id: uuid.UUID | None = None
    surgery_date: dt.date
    procedure: str = ""
    surgeon: str = ""
    owner: str = ""
    admission_time: str = "08:00"


def _new_patient(db: Session, p: Principal, body: PatientIn) -> m.Patient:
    if not body.informed:
        raise HTTPException(422, "Confirmez que le patient a été informé du traitement de ses données (loi 09-08, art. 5)")
    try:
        pat = intake.make_patient(db, p.establishment_id, first_name=body.first_name, last_name=body.last_name, birth_date=body.birth_date,
                                  phone=body.phone, email=body.email, language=body.language, preferred_channel=body.preferred_channel)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    svc.audit(db, p, "patient.create", "patient", pat.id, informed=True)
    return pat


@router.post("/patients", status_code=201)
def create_patient(body: PatientIn, p: Principal = Coord, db: Session = Depends(get_db)):
    pat = _new_patient(db, p, body)
    db.commit()
    return {"id": str(pat.id), "ref": pat.ref}


@router.get("/patients")
def list_patients(p: Principal = Any_, db: Session = Depends(get_db)):
    rows = db.scalars(select(m.Patient).where(m.Patient.establishment_id == p.establishment_id, m.Patient.anonymized_at.is_(None))).all()
    return [{"id": str(r.id), "ref": r.ref, "first_name": r.first_name, "last_name": r.last_name} for r in rows]


@router.get("/templates")
def list_templates(p: Principal = Any_, db: Session = Depends(get_db)):
    rows = db.scalars(select(m.JourneyTemplate).where(m.JourneyTemplate.establishment_id == p.establishment_id)).all()
    return [{"id": str(t.id), "name": t.name, "version": t.version, "status": t.status,
             "steps": [{"offset_days": s.offset_days, "title": s.title, "kind": s.kind,
                        "required_document": s.required_document, "blocking": s.blocking} for s in t.steps]}
            for t in rows]


@router.post("/templates/seed-ambulatory", status_code=201)
def seed(p: Principal = Depends(require_roles("admin", "designer")), db: Session = Depends(get_db)):
    t = svc.seed_ambulatory_template(db, p.establishment_id)
    db.flush()
    svc.audit(db, p, "template.seed", "journey_template", t.id)
    db.commit()
    return {"id": str(t.id)}


@router.post("/templates/{template_id}/new-version", status_code=201)
def new_version(template_id: uuid.UUID, p: Principal = Depends(require_roles("admin", "designer")),
                db: Session = Depends(get_db)):
    t = svc.new_template_version(db, svc.get_scoped(db, m.JourneyTemplate, template_id, p))
    db.flush()
    svc.audit(db, p, "template.new_version", "journey_template", t.id, version=t.version)
    db.commit()
    return {"id": str(t.id), "version": t.version, "status": t.status}


class StepIn(BaseModel):
    offset_days: int
    title: str
    kind: str = "task"
    required_document: str | None = None
    blocking: bool = False


@router.put("/templates/{template_id}/steps")
def replace_steps(template_id: uuid.UUID, steps: list[StepIn],
                  p: Principal = Depends(require_roles("admin", "designer")), db: Session = Depends(get_db)):
    t = svc.get_scoped(db, m.JourneyTemplate, template_id, p)
    if t.status != "draft":
        raise HTTPException(409, "Un parcours publié est immuable : créez une nouvelle version")
    if any(s.kind not in ("task", "document", "questionnaire", "message") for s in steps):
        raise HTTPException(422, "Type d'étape inconnu")
    t.steps = [m.TemplateStep(**s.model_dump()) for s in steps]
    svc.audit(db, p, "template.edit", "journey_template", t.id, steps=len(steps))
    db.commit()
    return {"id": str(t.id), "steps": len(steps)}


@router.post("/templates/{template_id}/publish")
def publish(template_id: uuid.UUID, p: Principal = Depends(require_roles("admin", "designer")),
            db: Session = Depends(get_db)):
    t = svc.get_scoped(db, m.JourneyTemplate, template_id, p)
    if t.status != "draft":
        raise HTTPException(409, "Seul un brouillon peut être publié")
    for old in db.scalars(select(m.JourneyTemplate).where(
            m.JourneyTemplate.establishment_id == p.establishment_id, m.JourneyTemplate.name == t.name,
            m.JourneyTemplate.status == "published")):
        old.status = "archived"  # les parcours déjà instanciés gardent leur version
    t.status = "published"
    svc.audit(db, p, "template.publish", "journey_template", t.id, version=t.version)
    db.commit()
    return {"id": str(t.id), "status": t.status}


@router.post("/journeys", status_code=201)
def create_journey(body: JourneyIn, p: Principal = Coord, db: Session = Depends(get_db)):
    if (body.patient_id is None) == (body.patient is None):
        raise HTTPException(422, "Indiquez soit patient_id, soit les informations d'un nouveau patient")
    tpl = svc.get_scoped(db, m.JourneyTemplate, body.template_id, p) if body.template_id else None
    pat = svc.get_scoped(db, m.Patient, body.patient_id, p) if body.patient_id else _new_patient(db, p, body.patient)
    j = intake.make_journey(db, p, pat, surgery_date=body.surgery_date, procedure=body.procedure, surgeon=body.surgeon,
                            owner=body.owner, admission_time=body.admission_time, template=tpl)
    db.commit()
    return {"id": str(j.id), "tasks": len(j.tasks), "reference": j.reference}


@router.get("/journeys/{journey_id}/tasks")
def journey_tasks(journey_id: uuid.UUID, p: Principal = Any_, db: Session = Depends(get_db)):
    j = svc.get_scoped(db, m.PatientJourney, journey_id, p)
    return [{"id": str(t.id), "title": t.title, "due_date": t.due_date.isoformat(), "status": t.status,
             "blocking": t.blocking, "required_document": t.required_document}
            for t in sorted(j.tasks, key=lambda t: t.due_date)]


@router.post("/tasks/{task_id}/complete")
def complete(task_id: uuid.UUID, p: Principal = Coord, db: Session = Depends(get_db)):
    t = svc.get_scoped(db, m.Task, task_id, p)
    svc.complete_task(t)
    svc.audit(db, p, "task.complete", "task", t.id, journey_id=str(t.journey_id), title=t.title)
    db.commit()
    return {"id": str(t.id), "status": t.status}


@router.get("/cockpit")
def get_cockpit(p: Principal = Any_, db: Session = Depends(get_db)):
    return views.cockpit(db, p.establishment_id)


@router.get("/me")
def me(p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    est = db.get(m.Establishment, p.establishment_id)
    enabled, reason = svc.ai_status(est)
    return {"establishment": est.name if est else "", "roles": sorted(p.roles), "ai_enabled": enabled, "ai_blocked_reason": reason,
            "cndp_ref": est.cndp_ref if est else ""}


@router.get("/journeys")
def list_journeys(p: Principal = Any_, db: Session = Depends(get_db)):
    return views.journey_list(db, p.establishment_id)


@router.get("/journeys/{journey_id}/detail")
def journey_detail(journey_id: uuid.UUID, p: Principal = Any_, db: Session = Depends(get_db)):
    return views.journey_detail(db, svc.get_scoped(db, m.PatientJourney, journey_id, p))


@router.get("/analytics")
def get_analytics(p: Principal = Any_, db: Session = Depends(get_db)):
    return svc.analytics(db, p.establishment_id)


@router.get("/audit")
def get_audit(p: Principal = Depends(require_roles("admin", "coordinator")), db: Session = Depends(get_db)):
    rows = db.scalars(select(m.AuditLog).where(m.AuditLog.establishment_id == p.establishment_id)
                      .order_by(m.AuditLog.at.desc()).limit(200)).all()
    return [{"at": r.at.isoformat(), "actor": r.actor, "action": r.action, "entity": r.entity,
             "entity_id": r.entity_id} for r in rows]
