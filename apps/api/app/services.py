"""Logique métier : isolation par établissement, parcours, cockpit, analytics, store vectoriel."""
from __future__ import annotations

import datetime as dt
import math
import uuid
from typing import TypeVar

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ai.providers.base import CallContext, UsageRecord
from ai.rag.service import Passage
from app import models as m
from app.core import Principal, get_settings

M = TypeVar("M")


# ---------------------------------------------------------------- tenancy / audit
def get_scoped(db: Session, model: type[M], obj_id: uuid.UUID, p: Principal) -> M:
    """Charge un objet en imposant l'établissement du jeton. 404 (pas 403) pour ne rien révéler."""
    obj = db.get(model, obj_id)
    if obj is None or getattr(obj, "establishment_id") != p.establishment_id:
        raise HTTPException(404, "Introuvable")
    return obj


def audit(db: Session, p: Principal, action: str, entity: str, entity_id, **detail) -> None:
    detail = {**detail, "actor_label": p.name or p.email or p.sub}
    db.add(m.AuditLog(establishment_id=p.establishment_id, actor=p.sub, action=action,
                      entity=entity, entity_id=str(entity_id), detail=detail))


# ---------------------------------------------------------------- parcours
AMBULATORY_STEPS = [
    (-21, "Création du parcours", "task", None, False),
    (-14, "Pièce d'identité", "document", "piece_identite", True),
    (-14, "Carte Vitale", "document", "carte_vitale", True),
    (-14, "Questionnaire d'admission", "questionnaire", "questionnaire_admission", True),
    (-14, "Revue des documents administratifs", "task", None, False),
    (-10, "Attestation de mutuelle", "document", "mutuelle", True),
    (-10, "Rappel", "message", None, False),
    (-7, "Consentement administratif signé", "document", "consentement_admin", True),
    (-7, "Revue des réponses", "task", None, False),
    (-3, "Relance coordinatrice", "task", None, False),
    (-1, "Informations pratiques", "message", None, False),
    (0, "Mise à jour du statut d'intervention", "task", None, False),
    (1, "Suivi administratif", "task", None, False),
    (7, "Questionnaire de satisfaction", "questionnaire", None, False),
    (7, "Parcours terminé", "task", None, False),
]


def seed_ambulatory_template(db: Session, est_id: uuid.UUID) -> m.JourneyTemplate:
    t = m.JourneyTemplate(establishment_id=est_id, name="Chirurgie ambulatoire J-21 → J+7", status="published")
    t.steps = [m.TemplateStep(offset_days=o, title=ti, kind=k, required_document=d, blocking=b)
               for o, ti, k, d, b in AMBULATORY_STEPS]
    db.add(t)
    return t


def new_template_version(db: Session, src: m.JourneyTemplate) -> m.JourneyTemplate:
    """Versionnement : on ne modifie jamais un parcours publié, on en dérive une nouvelle version."""
    latest = db.scalar(select(func.max(m.JourneyTemplate.version)).where(
        m.JourneyTemplate.establishment_id == src.establishment_id, m.JourneyTemplate.name == src.name))
    t = m.JourneyTemplate(establishment_id=src.establishment_id, name=src.name, version=(latest or 0) + 1, status="draft")
    t.steps = [m.TemplateStep(offset_days=s.offset_days, title=s.title, kind=s.kind,
                              required_document=s.required_document, blocking=s.blocking) for s in src.steps]
    db.add(t)
    return t


def instantiate_journey(db: Session, tpl: m.JourneyTemplate, patient: m.Patient, surgery_date: dt.date) -> m.PatientJourney:
    if tpl.status != "published":
        raise HTTPException(409, "Seul un parcours publié peut être instancié")
    j = m.PatientJourney(establishment_id=tpl.establishment_id, patient_id=patient.id, template_id=tpl.id,
                         template_version=tpl.version, surgery_date=surgery_date)
    j.tasks = [m.Task(establishment_id=tpl.establishment_id, title=s.title, kind=s.kind,
                      required_document=s.required_document, blocking=s.blocking,
                      due_date=surgery_date + dt.timedelta(days=s.offset_days)) for s in tpl.steps]
    db.add(j)
    return j


def complete_task(task: m.Task, *, automated: bool = False) -> None:
    task.status, task.automated = "done", automated
    task.completed_at = dt.datetime.now(dt.timezone.utc)


def analytics(db: Session, est_id: uuid.UUID, today: dt.date | None = None) -> dict:
    today = today or dt.date.today()
    tasks = db.scalars(select(m.Task).where(m.Task.establishment_id == est_id)).all()
    due = [t for t in tasks if t.due_date <= today]
    done_due = [t for t in due if t.status == "done"]
    delays = [(t.completed_at.date() - t.due_date).days for t in tasks if t.completed_at]
    auto = sum(1 for t in tasks if t.automated)
    return {
        "completeness_rate": round(len(done_due) / len(due), 2) if due else None,
        "avg_completion_delay_days": round(sum(delays) / len(delays), 1) if delays else None,
        "reminders_sent": sum(t.reminders for t in tasks),
        "automated_tasks": auto,
        "minutes_saved_estimate": auto * get_settings().minutes_saved_per_automated_task,
        "note": "Temps économisé = estimation (tâches validées via IA × minutes forfaitaires configurables), pas une mesure.",
    }


# ---------------------------------------------------------------- IA : budget, usage, store
def month_start() -> dt.datetime:
    n = dt.datetime.now(dt.timezone.utc)
    return n.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def ai_context(db: Session, p: Principal, agent: str) -> CallContext:
    est = db.get(m.Establishment, p.establishment_id)
    used = db.scalar(select(func.coalesce(func.sum(m.AIUsage.input_tokens + m.AIUsage.output_tokens), 0)).where(
        m.AIUsage.establishment_id == p.establishment_id, m.AIUsage.at >= month_start())) or 0
    return CallContext(str(p.establishment_id), agent,
                       ai_enabled=bool(get_settings().ai_enabled and est and est.ai_enabled),
                       monthly_token_budget=est.monthly_token_budget if est else 0,
                       tokens_used_this_month=int(used))


def usage_sink(db: Session):
    def sink(u: UsageRecord) -> None:
        db.add(m.AIUsage(establishment_id=uuid.UUID(u.establishment_id), agent=u.agent, model=u.model, kind=u.kind,
                         input_tokens=u.input_tokens, output_tokens=u.output_tokens, cost_eur=u.cost_eur))
    return sink


def _cos(a: list[float], b: list[float]) -> float:
    na, nb = math.sqrt(sum(x * x for x in a)), math.sqrt(sum(x * x for x in b))
    return sum(x * y for x, y in zip(a, b)) / (na * nb) if na and nb else 0.0


class SqlVectorStore:
    """Implémente ai.rag.VectorStore. Filtre toujours établissement + document approuvé."""

    def __init__(self, db: Session):
        self.db = db

    def add_chunks(self, establishment_id, document_id, texts, vectors):
        for t, v in zip(texts, vectors):
            self.db.add(m.KnowledgeChunk(establishment_id=uuid.UUID(establishment_id),
                                         document_id=uuid.UUID(document_id), content=t, embedding=v))
        self.db.flush()

    def search(self, establishment_id, vector, k):
        est = uuid.UUID(establishment_id)
        base = (select(m.KnowledgeChunk, m.KnowledgeDocument)
                .join(m.KnowledgeDocument, m.KnowledgeDocument.id == m.KnowledgeChunk.document_id)
                .where(m.KnowledgeChunk.establishment_id == est, m.KnowledgeDocument.establishment_id == est,
                       m.KnowledgeDocument.status == "approved"))
        if self.db.bind.dialect.name == "postgresql":
            q = base.order_by(m.KnowledgeChunk.embedding.op("<=>")(vector)).limit(k)
            hits = self.db.execute(q).all()
            return [Passage(str(d.id), d.title, d.version, c.content, 0.0) for c, d in hits]
        scored = sorted(((_cos(vector, c.embedding), c, d) for c, d in self.db.execute(base).all()),
                        key=lambda x: -x[0])[:k]
        return [Passage(str(d.id), d.title, d.version, c.content, s) for s, c, d in scored]
