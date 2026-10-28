"""Experience endpoints: local document reading, refresh revisions, action previews, patient assistance and demo."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import shutil
import uuid
from typing import Literal

import jwt
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import compliance, experience as x, intake, models as m, reading, services as svc, speech, storage
from app.core import PORTAL_ISSUER, Principal, current_principal, get_db, get_settings, require_roles, today
from app.routers.portal import _patient, _need_consent

router = APIRouter()
Staff = Depends(require_roles("admin", "coordinator", "designer", "viewer"))
Coord = Depends(require_roles("admin", "coordinator"))
Admin = Depends(require_roles("admin"))
Patient = Depends(require_roles("patient"))


@router.get("/live/revision")
def revision(p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    # Hash metadata only. Patient scope is their journeys, never the establishment's stream.
    q = select(m.PatientJourney).where(m.PatientJourney.establishment_id == p.establishment_id)
    if "patient" in p.roles:
        pat = _patient(p, db)
        _need_consent(db, pat)
        q = q.where(m.PatientJourney.patient_id == pat.id)
    state = []
    for j in db.scalars(q).all():
        files = db.scalars(select(m.Document.id).where(m.Document.journey_id == j.id)).all()
        state.append([str(j.id), x.fingerprint(j), sorted(str(f) for f in files)])
    jids=[j.id for j in db.scalars(q)]
    for model,fields in [(m.AdministrativeCase,['journey_id','revision']),(m.InsuranceCase,['id','revision']),(m.Dispatch,['id','status']),(m.AdministrativeEvent,['id','kind']),(m.FinanceEntry,['id','kind'])]:
        state.extend([[str(getattr(r,f)) for f in fields] for r in db.scalars(select(model).where(model.journey_id.in_(jids)))])
    if "patient" not in p.roles:
        logs = db.scalars(select(m.AuditLog).where(m.AuditLog.establishment_id == p.establishment_id).order_by(m.AuditLog.at.desc()).limit(1)).all()
        state.extend([str(a.id) for a in logs])
    else:
        proposals = db.scalars(select(m.AIProposal).where(m.AIProposal.establishment_id == p.establishment_id, m.AIProposal.journey_id.in_([j.id for j in db.scalars(q)]), m.AIProposal.status == "approved")).all()
        state.extend(str(a.id) for a in proposals)
    return {"revision": hashlib.sha256(json.dumps(state, sort_keys=True).encode()).hexdigest(), "checked_at": dt.datetime.now(dt.timezone.utc).isoformat()}


@router.get("/journeys/{jid}/blockers")
def explain(jid: uuid.UUID, p: Principal = Staff, db: Session = Depends(get_db)):
    return x.blockers(svc.get_scoped(db, m.PatientJourney, jid, p))


@router.post("/documents/{doc_id}/analyze")
def analyze(doc_id: uuid.UUID, p: Principal = Coord, db: Session = Depends(get_db)):
    doc = svc.get_scoped(db, m.Document, doc_id, p)
    report = reading.analyze_document(db, doc)
    svc.audit(db, p, "document.analyze", "document", doc.id, journey_id=str(doc.journey_id), engine=report["engine"])
    db.commit()
    return report


@router.get("/documents/{doc_id}/analysis")
def get_reading(doc_id: uuid.UUID, p: Principal = Coord, db: Session = Depends(get_db)):
    doc = svc.get_scoped(db, m.Document, doc_id, p)
    return {"report": reading.saved_report(db, doc.id)}


class QueryIn(BaseModel):
    query: str = Field(min_length=3, max_length=500)


@router.post("/copilot/preview")
def preview(body: QueryIn, p: Principal = Coord, db: Session = Depends(get_db)):
    plan = x.make_plan(db, p, body.query)
    db.commit()
    return plan


@router.post("/copilot/plans/{plan_id}/apply")
def apply(plan_id: uuid.UUID, p: Principal = Coord, db: Session = Depends(get_db)):
    plan = db.scalar(select(m.ActionPlan).where(m.ActionPlan.id == plan_id, m.ActionPlan.establishment_id == p.establishment_id).with_for_update())
    if plan is None or plan.intent != "prepare_reminders":
        raise HTTPException(404, "Plan introuvable")
    result = x.apply_plan(db, p, plan)
    db.commit()
    return result


class SimStep(BaseModel):
    offset_days: int = Field(ge=-365, le=365)
    title: str = Field(min_length=1, max_length=200)
    kind: Literal["document", "task", "message", "questionnaire"]
    blocking: bool = False


class SimIn(BaseModel):
    steps: list[SimStep] = Field(max_length=100)
    surgery_date: dt.date
    scenario: Literal["on_time", "missing_document"] = "on_time"


@router.post("/simulator")
def simulator(body: SimIn, p: Principal = Staff):
    return x.simulate([s.model_dump() for s in body.steps], body.surgery_date, body.scenario)


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    language: Literal["fr", "darija"] = "fr"


@router.post("/portal/assistant")
def patient_chat(body: ChatIn, p: Principal = Patient, db: Session = Depends(get_db)):
    pat = _patient(p, db)
    _need_consent(db, pat)
    result = x.reply(db, p.establishment_id, body.message, body.language)
    db.commit()  # only demo procedure initialization, never log patient question
    return result


@router.get("/portal/assistant/capabilities")
def capabilities(p: Principal = Patient, db: Session = Depends(get_db)):
    _need_consent(db, _patient(p, db))
    return {"voice": speech.available(), "voice_engine": "whisper-local", "max_seconds": 30}


@router.post("/portal/assistant/transcribe")
async def transcribe(file: UploadFile = File(...), p: Principal = Patient, db: Session = Depends(get_db)):
    _need_consent(db, _patient(p, db))
    data = await file.read(5 * 1024 * 1024 + 1)
    if not data or len(data) > 5 * 1024 * 1024:
        raise HTTPException(413, "Audio vide ou trop volumineux (5 Mo maximum)")
    try:
        return speech.transcribe(data)
    except ValueError as e:
        raise HTTPException(422, str(e))
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    except Exception:
        raise HTTPException(422, "Audio non lisible. Réessayez ou écrivez votre question.")


@router.post("/portal/assistant/handoff", status_code=201)
def handoff(body: ChatIn, p: Principal = Patient, db: Session = Depends(get_db)):
    pat = _patient(p, db)
    _need_consent(db, pat)
    item = m.SupportRequest(establishment_id=p.establishment_id, patient_id=pat.id, encrypted_message=storage._fernet().encrypt(body.message.encode()))
    db.add(item)
    db.flush()
    svc.audit(db, p, "support.request", "support_request", item.id)
    db.commit()
    return {"id": str(item.id), "status": item.status}


@router.get("/support-requests")
def support(p: Principal = Coord, db: Session = Depends(get_db)):
    rows = db.scalars(select(m.SupportRequest).where(m.SupportRequest.establishment_id == p.establishment_id).order_by(m.SupportRequest.created_at.desc()).limit(100)).all()
    return [{"id": str(r.id), "patient_name": f"{pat.first_name} {pat.last_name}", "message": storage._fernet().decrypt(r.encrypted_message).decode(),
             "status": r.status, "created_at": r.created_at.isoformat()} for r in rows if (pat := db.get(m.Patient, r.patient_id)) and not pat.anonymized_at]


@router.post("/support-requests/{rid}/resolve")
def resolve_support(rid: uuid.UUID, p: Principal = Coord, db: Session = Depends(get_db)):
    row = svc.get_scoped(db, m.SupportRequest, rid, p)
    row.status = "done"
    svc.audit(db, p, "support.resolve", "support_request", row.id)
    db.commit()
    return {"status": row.status}


class CardIn(BaseModel):
    topic: Literal["documents", "insurance", "arrival", "privacy"]
    title: str = Field(min_length=1, max_length=200)
    fr: str = Field(min_length=1, max_length=3000)
    darija: str = Field(default="", max_length=3000)


@router.get("/procedures")
def cards(p: Principal = Staff, db: Session = Depends(get_db)):
    x.ensure_demo_procedures(db, p.establishment_id)
    db.commit()
    rows = db.scalars(select(m.ProcedureCard).where(m.ProcedureCard.establishment_id == p.establishment_id)).all()
    return [{"id": str(c.id), "topic": c.topic, "title": c.title, "version": c.version, "status": c.status, "content": c.content, "approved_by": c.approved_by} for c in rows]


@router.post("/procedures", status_code=201)
def create_card(body: CardIn, p: Principal = Admin, db: Session = Depends(get_db)):
    row = m.ProcedureCard(establishment_id=p.establishment_id, topic=body.topic, title=body.title, content={"fr": body.fr, "darija": body.darija})
    db.add(row)
    db.flush()
    svc.audit(db, p, "procedure.create", "procedure_card", row.id)
    db.commit()
    return {"id": str(row.id)}


@router.post("/procedures/{cid}/approve")
def approve_card(cid: uuid.UUID, p: Principal = Admin, db: Session = Depends(get_db)):
    row = svc.get_scoped(db, m.ProcedureCard, cid, p)
    # Retire the previous active version; approval is a named human action.
    old = db.scalars(select(m.ProcedureCard).where(m.ProcedureCard.establishment_id == p.establishment_id, m.ProcedureCard.topic == row.topic, m.ProcedureCard.status == "approved")).all()
    for prev in old:
        if prev.id != row.id:
            prev.status = "retired"
    row.version = max([c.version for c in old] + [0]) + (0 if row.status == "approved" else 1)
    row.status, row.approved_by = "approved", p.name or p.sub
    svc.audit(db, p, "procedure.approve", "procedure_card", row.id, version=row.version)
    db.commit()
    return {"id": str(row.id), "version": row.version}


class DemoIn(BaseModel):
    request_id: uuid.UUID


def _demo_only():
    if not get_settings().demo_mode:
        raise HTTPException(404, "Disponible en mode démonstration uniquement")


@router.post("/demo/scenarios", status_code=201)
def demo(body: DemoIn, p: Principal = Coord, db: Session = Depends(get_db)):
    _demo_only()
    prev = db.get(m.ActionPlan, body.request_id)
    if prev is not None:
        if prev.establishment_id != p.establishment_id or prev.actor != p.sub or prev.intent != "demo":
            raise HTTPException(404, "Scénario introuvable")
        return {"id": str(prev.id), **prev.payload}
    pat = intake.make_patient(db, p.establishment_id, first_name="Amal", last_name="Démo guidée", birth_date="14/03/1986", language="fr")
    tpl = intake.default_template(db, p.establishment_id)
    j = intake.make_journey(db, p, pat, surgery_date=today()+dt.timedelta(days=8), procedure="Parcours fictif · démonstration", template=tpl)
    for t in j.tasks:
        if t.required_document and t.required_document != "mutuelle":
            svc.complete_task(t)
    db.flush()
    payload = {"journey_id": str(j.id), "patient_id": str(pat.id), "reference": j.reference}
    row = m.ActionPlan(id=body.request_id, establishment_id=p.establishment_id, actor=p.sub, intent="demo", payload=payload)
    db.add(row)
    svc.audit(db, p, "demo.create", "patient_journey", j.id, journey_id=str(j.id))
    db.commit()
    return {"id": str(row.id), **payload}


def demo_journey(db, p, scenario_id):
    _demo_only()
    row = svc.get_scoped(db, m.ActionPlan, scenario_id, p)
    if row.intent != "demo" or row.actor != p.sub:
        raise HTTPException(404, "Scénario introuvable")
    return svc.get_scoped(db, m.PatientJourney, uuid.UUID(row.payload["journey_id"]), p)


@router.post("/demo/scenarios/{sid}/sample")
def demo_upload(sid: uuid.UUID, p: Principal = Coord, db: Session = Depends(get_db)):
    from reportlab.pdfgen import canvas
    from io import BytesIO
    j = demo_journey(db, p, sid)
    task = next(t for t in j.tasks if t.required_document == "mutuelle")
    old = db.scalar(select(m.Document).where(m.Document.task_id == task.id))
    if old:
        return {"document_id": str(old.id), "task_id": str(task.id), "report": reading.saved_report(db, old.id)}
    f = BytesIO()
    c = canvas.Canvas(f)
    for line, y in [("DEMONSTRATION - DOCUMENT FICTIF", 760), ("PRISE EN CHARGE MUTUELLE / ASSURANCE", 720),
                    ("Titulaire : Amal Demo", 680), ("Organisme : Mutuelle Exemple", 650),
                    ("Valable jusqu'au : " + (today()+dt.timedelta(days=365)).strftime("%d/%m/%Y"), 620)]:
        c.drawString(60, y, line)
    c.save()
    doc = storage.save_upload(db, p.establishment_id, j.id, task.id, "attestation-demo.pdf", f.getvalue(), "guided-demo")
    task.status = "submitted"
    db.flush()
    report = reading.analyze_document(db, doc)
    svc.audit(db, p, "portal.upload", "document", doc.id, journey_id=str(j.id), title=task.title, synthetic=True)
    db.commit()
    return {"document_id": str(doc.id), "task_id": str(task.id), "report": report}
