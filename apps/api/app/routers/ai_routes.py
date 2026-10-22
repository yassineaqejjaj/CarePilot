"""Routes IA : base de connaissance RAG, agents (→ propositions), validation humaine, coûts."""
from __future__ import annotations

import datetime as dt
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ai.agents.agents import (AdministrativeAgent, CommunicationAgent, FollowUpAgent, SummaryAgent)
from ai.providers.base import AIDisabledError, AIError, AIProvider, BudgetExceededError, GuardrailError
from ai.providers.openai_provider import OpenAIProvider
from ai.rag.service import RagService
from app import models as m
from app import services as svc
from app.core import Principal, get_db, require_roles

router = APIRouter(prefix="/ai")
Coord = Depends(require_roles("admin", "coordinator"))


def get_provider(db: Session = Depends(get_db)) -> AIProvider:
    return OpenAIProvider(usage_sink=svc.usage_sink(db))  # surchargé par MockProvider dans les tests


def _run(fn):
    try:
        return fn()
    except AIDisabledError as e:
        raise HTTPException(503, str(e))
    except BudgetExceededError as e:
        raise HTTPException(429, str(e))
    except GuardrailError as e:
        raise HTTPException(422, str(e))
    except AIError as e:
        raise HTTPException(502, str(e))


class DocIn(BaseModel):
    title: str
    text: str


@router.post("/documents", status_code=201)
def ingest(body: DocIn, p: Principal = Depends(require_roles("admin")), db: Session = Depends(get_db),
           prov: AIProvider = Depends(get_provider)):
    doc = m.KnowledgeDocument(establishment_id=p.establishment_id, title=body.title)
    db.add(doc)
    db.flush()
    n = _run(lambda: RagService(prov, svc.SqlVectorStore(db)).ingest(svc.ai_context(db, p, "rag"), str(doc.id), body.text))
    svc.audit(db, p, "kb.ingest", "knowledge_document", doc.id, chunks=n)
    db.commit()
    return {"id": str(doc.id), "chunks": n, "status": doc.status}


@router.post("/documents/{doc_id}/approve")
def approve_doc(doc_id: uuid.UUID, p: Principal = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    doc = svc.get_scoped(db, m.KnowledgeDocument, doc_id, p)
    doc.status, doc.approved_by = "approved", p.sub
    svc.audit(db, p, "kb.approve", "knowledge_document", doc.id, version=doc.version)
    db.commit()
    return {"id": str(doc.id), "status": doc.status}


def _propose(db, p, journey_id, agent, kind, payload) -> dict:
    prop = m.AIProposal(establishment_id=p.establishment_id, journey_id=journey_id, agent=agent, kind=kind,
                        payload=payload)
    db.add(prop)
    db.flush()
    svc.audit(db, p, "ai.propose", "ai_proposal", prop.id, agent=agent, kind=kind)
    db.commit()
    return {"proposal_id": str(prop.id), "status": "pending", "payload": payload}


@router.post("/verify/{journey_id}")
def verify(journey_id: uuid.UUID, p: Principal = Coord, db: Session = Depends(get_db),
           prov: AIProvider = Depends(get_provider)):
    j = svc.get_scoped(db, m.PatientJourney, journey_id, p)
    pat = db.get(m.Patient, j.patient_id)
    docs = [t for t in j.tasks if t.required_document]
    agent = AdministrativeAgent(prov, RagService(prov, svc.SqlVectorStore(db)))
    res = _run(lambda: agent.run(
        svc.ai_context(db, p, agent.name), required_docs=[t.required_document for t in docs],
        received_docs=[t.required_document for t in docs if t.status == "done"],
        days_to_surgery=(j.surgery_date - dt.date.today()).days, journey_ref=pat.ref))
    return _propose(db, p, j.id, agent.name, "verification", res.model_dump())


class DraftIn(BaseModel):
    journey_id: uuid.UUID
    approved_template: str
    purpose: str


@router.post("/communicate")
def communicate(body: DraftIn, p: Principal = Coord, db: Session = Depends(get_db),
                prov: AIProvider = Depends(get_provider)):
    j = svc.get_scoped(db, m.PatientJourney, body.journey_id, p)
    pat = db.get(m.Patient, j.patient_id)
    agent = CommunicationAgent(prov, RagService(prov, svc.SqlVectorStore(db)))
    res = _run(lambda: agent.run(svc.ai_context(db, p, agent.name), approved_template=body.approved_template,
                                 purpose=body.purpose, variables={"patient_first_name": pat.first_name}))
    return _propose(db, p, j.id, agent.name, "message_draft", res.model_dump())


class ReplyIn(BaseModel):
    journey_id: uuid.UUID
    patient_reply: str


@router.post("/followup")
def followup(body: ReplyIn, p: Principal = Coord, db: Session = Depends(get_db),
             prov: AIProvider = Depends(get_provider)):
    j = svc.get_scoped(db, m.PatientJourney, body.journey_id, p)
    agent = FollowUpAgent(prov)
    res = _run(lambda: agent.run(svc.ai_context(db, p, agent.name), patient_reply=body.patient_reply,
                                 open_tasks=[t.title for t in j.tasks if t.status != "done"]))
    return _propose(db, p, j.id, agent.name, "followup", res.model_dump(mode="json"))


@router.post("/summary/{journey_id}")
def summary(journey_id: uuid.UUID, p: Principal = Coord, db: Session = Depends(get_db),
            prov: AIProvider = Depends(get_provider)):
    j = svc.get_scoped(db, m.PatientJourney, journey_id, p)
    events = [f"{t.due_date} {t.title} : {t.status}" for t in sorted(j.tasks, key=lambda t: t.due_date)]
    agent = SummaryAgent(prov)
    res = _run(lambda: agent.run(svc.ai_context(db, p, agent.name), events=events))
    return _propose(db, p, j.id, agent.name, "summary", res.model_dump())


@router.get("/proposals")
def proposals(status: str = "pending", p: Principal = Coord, db: Session = Depends(get_db)):
    rows = db.scalars(select(m.AIProposal).where(m.AIProposal.establishment_id == p.establishment_id,
                                                  m.AIProposal.status == status)).all()
    return [{"id": str(r.id), "agent": r.agent, "kind": r.kind, "payload": r.payload, "status": r.status} for r in rows]


def _decide(proposal_id, decision, p, db):
    prop = svc.get_scoped(db, m.AIProposal, proposal_id, p)
    if prop.status != "pending":
        raise HTTPException(409, "Proposition déjà traitée")
    prop.status, prop.decided_by = decision, p.sub
    svc.audit(db, p, f"ai.{decision}", "ai_proposal", prop.id, kind=prop.kind,
              journey_id=str(prop.journey_id) if prop.journey_id else None)
    return prop


@router.post("/proposals/{proposal_id}/approve")
def approve(proposal_id: uuid.UUID, p: Principal = Coord, db: Session = Depends(get_db)):
    prop = _decide(proposal_id, "approved", p, db)
    tid = prop.payload.get("task_id") if prop.kind == "message_draft" else None
    if tid:  # la relance validée compte comme relance ; AUCUN envoi réel dans le MVP
        task = db.get(m.Task, uuid.UUID(tid))
        if task is not None and task.establishment_id == p.establishment_id:
            task.reminders += 1
    # Seule action appliquée automatiquement après validation humaine : marquer un document requis
    # comme reçu N'EST PAS fait ici (un humain contrôle la pièce). Les messages ne sont pas envoyés dans le MVP.
    db.commit()
    return {"id": str(prop.id), "status": prop.status}


@router.post("/proposals/{proposal_id}/reject")
def reject(proposal_id: uuid.UUID, p: Principal = Coord, db: Session = Depends(get_db)):
    prop = _decide(proposal_id, "rejected", p, db)
    db.commit()
    return {"id": str(prop.id), "status": prop.status}


@router.get("/usage")
def usage(p: Principal = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    rows = db.execute(select(m.AIUsage.agent, func.count(), func.sum(m.AIUsage.input_tokens),
                             func.sum(m.AIUsage.output_tokens), func.sum(m.AIUsage.cost_eur))
                      .where(m.AIUsage.establishment_id == p.establishment_id, m.AIUsage.at >= svc.month_start())
                      .group_by(m.AIUsage.agent)).all()
    return [{"agent": a, "calls": n, "input_tokens": i or 0, "output_tokens": o or 0, "cost_eur": round(c or 0, 6)}
            for a, n, i, o, c in rows]
