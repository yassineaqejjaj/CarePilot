"""Portail patient : le patient ne voit que SES parcours, et ne peut que soumettre ses pièces/questionnaires.
Il ne valide jamais lui-même une tâche : un coordinateur contrôle (statut `submitted` -> `done`)."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models as m
from app import services as svc
from app.core import Principal, get_db, require_roles

router = APIRouter(prefix="/portal")
Patient = Depends(require_roles("patient"))


def _patient(p: Principal, db: Session) -> m.Patient:
    if p.patient_id is None:
        raise HTTPException(403, "Compte patient non rattaché")
    return svc.get_scoped(db, m.Patient, p.patient_id, p)


@router.get("/me")
def me(p: Principal = Patient, db: Session = Depends(get_db)):
    pat = _patient(p, db)
    journeys = db.scalars(select(m.PatientJourney).where(
        m.PatientJourney.patient_id == pat.id, m.PatientJourney.establishment_id == p.establishment_id)).all()
    out = []
    for j in journeys:
        msgs = db.scalars(select(m.AIProposal).where(
            m.AIProposal.journey_id == j.id, m.AIProposal.kind == "message_draft",
            m.AIProposal.status == "approved")).all()  # uniquement des messages validés par un humain
        visible = [t for t in sorted(j.tasks, key=lambda t: t.due_date)
                   if t.kind in ("document", "questionnaire") or t.title == "Informations pratiques"]
        done = sum(t.status == "done" for t in visible)
        out.append({
            "journey_id": str(j.id), "surgery_date": j.surgery_date.isoformat(), "procedure": j.procedure,
            "admission_time": j.admission_time, "progress": {"done": done, "total": len(visible)},
            "tasks": [{"id": str(t.id), "title": t.title, "kind": t.kind, "due_date": t.due_date.isoformat(),
                       "status": t.status, "can_submit": t.kind in ("document", "questionnaire")} for t in visible],
            "messages": [{"subject": x.payload.get("subject"), "body": x.payload.get("body")} for x in msgs]})
    est = db.get(m.Establishment, p.establishment_id)
    return {"first_name": pat.first_name, "establishment": est.name if est else "", "journeys": out}


class SubmitIn(BaseModel):
    response: dict = {}


@router.post("/tasks/{task_id}/submit")
def submit(task_id: uuid.UUID, body: SubmitIn, p: Principal = Patient, db: Session = Depends(get_db)):
    pat = _patient(p, db)
    t = svc.get_scoped(db, m.Task, task_id, p)
    if t.journey.patient_id != pat.id or t.kind not in ("document", "questionnaire"):
        raise HTTPException(404, "Introuvable")
    if t.status != "todo":
        raise HTTPException(409, "Déjà soumis")
    t.status, t.response = "submitted", body.response
    svc.audit(db, p, "portal.submit", "task", t.id, kind=t.kind, journey_id=str(t.journey_id), title=t.title)  # le contenu de la réponse n'est pas journalisé
    db.commit()
    return {"id": str(t.id), "status": t.status}
