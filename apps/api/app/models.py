from __future__ import annotations

import datetime as dt
import uuid

from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, TypeDecorator
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.core import get_settings


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class Base(DeclarativeBase):
    pass


class EmbeddingType(TypeDecorator):
    """pgvector sous PostgreSQL ; JSON ailleurs (tests SQLite)."""
    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(Vector(get_settings().embedding_dim))
        return dialect.type_descriptor(JSON())


def _est_fk() -> Mapped[uuid.UUID]:
    return mapped_column(ForeignKey("establishment.id"), index=True)


class Establishment(Base):
    __tablename__ = "establishment"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200))
    ai_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    monthly_token_budget: Mapped[int] = mapped_column(Integer, default=2_000_000)


class Patient(Base):
    """Patients FICTIFS uniquement dans le MVP."""
    __tablename__ = "patient"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    establishment_id: Mapped[uuid.UUID] = _est_fk()
    ref: Mapped[str] = mapped_column(String(32))  # pseudonyme envoyé à l'IA à la place de l'identité
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(200), default="")
    birth_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)


class JourneyTemplate(Base):
    __tablename__ = "journey_template"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    establishment_id: Mapped[uuid.UUID] = _est_fk()
    name: Mapped[str] = mapped_column(String(200))
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft | published | archived
    steps: Mapped[list[TemplateStep]] = relationship(back_populates="template", cascade="all, delete-orphan",
                                                     order_by="TemplateStep.offset_days")


class TemplateStep(Base):
    __tablename__ = "template_step"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    template_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("journey_template.id"), index=True)
    offset_days: Mapped[int] = mapped_column(Integer)  # J-21 => -21
    title: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(30), default="task")  # task | document | questionnaire | message
    required_document: Mapped[str | None] = mapped_column(String(100), nullable=True)
    blocking: Mapped[bool] = mapped_column(Boolean, default=False)
    template: Mapped[JourneyTemplate] = relationship(back_populates="steps")


class PatientJourney(Base):
    __tablename__ = "patient_journey"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    establishment_id: Mapped[uuid.UUID] = _est_fk()
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patient.id"), index=True)
    template_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("journey_template.id"))
    template_version: Mapped[int] = mapped_column(Integer)
    surgery_date: Mapped[dt.date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active | completed | cancelled
    reference: Mapped[str] = mapped_column(String(32), default="")  # ex. PAR-2026-04817
    procedure: Mapped[str] = mapped_column(String(200), default="")
    surgeon: Mapped[str] = mapped_column(String(100), default="")
    owner: Mapped[str] = mapped_column(String(100), default="")  # coordinateur responsable
    admission_time: Mapped[str] = mapped_column(String(10), default="")
    completed_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    tasks: Mapped[list[Task]] = relationship(back_populates="journey", cascade="all, delete-orphan")


class Task(Base):
    __tablename__ = "task"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    establishment_id: Mapped[uuid.UUID] = _est_fk()
    journey_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patient_journey.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(30), default="task")
    required_document: Mapped[str | None] = mapped_column(String(100), nullable=True)
    due_date: Mapped[dt.date] = mapped_column(Date)
    blocking: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20), default="todo")  # todo | submitted | done
    completed_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    automated: Mapped[bool] = mapped_column(Boolean, default=False)  # validée via proposition IA
    reminders: Mapped[int] = mapped_column(Integer, default=0)
    owner: Mapped[str | None] = mapped_column(String(100), nullable=True)
    detail: Mapped[str] = mapped_column(Text, default="")
    response: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # réponse patient (questionnaire / pièce)
    journey: Mapped[PatientJourney] = relationship(back_populates="tasks")


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    establishment_id: Mapped[uuid.UUID] = _est_fk()
    actor: Mapped[str] = mapped_column(String(100))
    action: Mapped[str] = mapped_column(String(100))
    entity: Mapped[str] = mapped_column(String(50))
    entity_id: Mapped[str] = mapped_column(String(50))
    detail: Mapped[dict] = mapped_column(JSON, default=dict)
    at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_now)


class KnowledgeDocument(Base):
    __tablename__ = "knowledge_document"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    establishment_id: Mapped[uuid.UUID] = _est_fk()
    title: Mapped[str] = mapped_column(String(200))
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft | approved | retired
    approved_by: Mapped[str | None] = mapped_column(String(100), nullable=True)


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunk"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    establishment_id: Mapped[uuid.UUID] = _est_fk()
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("knowledge_document.id"), index=True)
    content: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float]] = mapped_column(EmbeddingType)


class AIUsage(Base):
    __tablename__ = "ai_usage"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    establishment_id: Mapped[uuid.UUID] = _est_fk()
    agent: Mapped[str] = mapped_column(String(50))
    model: Mapped[str] = mapped_column(String(100))
    kind: Mapped[str] = mapped_column(String(20))
    input_tokens: Mapped[int] = mapped_column(Integer)
    output_tokens: Mapped[int] = mapped_column(Integer)
    cost_eur: Mapped[float] = mapped_column(Float)
    at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_now)


class AIProposal(Base):
    __tablename__ = "ai_proposal"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    establishment_id: Mapped[uuid.UUID] = _est_fk()
    journey_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("patient_journey.id"), nullable=True)
    agent: Mapped[str] = mapped_column(String(50))
    kind: Mapped[str] = mapped_column(String(50))  # verification | message_draft | followup | summary
    payload: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | approved | rejected
    decided_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_now)
