from __future__ import annotations

import datetime as dt
import uuid

from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, LargeBinary, String, Text, TypeDecorator, UniqueConstraint
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
    city: Mapped[str] = mapped_column(String(100), default="")
    # Loi 09-08 : référence de l'autorisation CNDP du traitement et, le cas échéant, du transfert à l'étranger
    cndp_ref: Mapped[str] = mapped_column(String(100), default="")
    cndp_transfer_ref: Mapped[str] = mapped_column(String(100), default="")
    dpo_contact: Mapped[str] = mapped_column(String(200), default="")  # contact pour exercer accès / rectification / opposition
    retention_days: Mapped[int] = mapped_column(Integer, default=365)  # après clôture du parcours


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
    phone: Mapped[str] = mapped_column(String(20), default="")  # E.164, ex. +212612345678
    language: Mapped[str] = mapped_column(String(5), default="fr")  # fr | ar
    preferred_channel: Mapped[str] = mapped_column(String(10), default="whatsapp")  # whatsapp | sms | email
    anonymized_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


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
    last_reminder_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
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


class Consent(Base):
    """Consentement du patient au traitement (loi 09-08, art. 4 et 5), versionné avec la notice affichée."""
    __tablename__ = "consent"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    establishment_id: Mapped[uuid.UUID] = _est_fk()
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patient.id"), index=True)
    purpose: Mapped[str] = mapped_column(String(60), default="administrative_follow_up")
    notice_version: Mapped[str] = mapped_column(String(20))
    channel: Mapped[str] = mapped_column(String(20), default="portal")
    given_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_now)


class DataRequest(Base):
    """Exercice des droits : accès, rectification, opposition, suppression."""
    __tablename__ = "data_request"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    establishment_id: Mapped[uuid.UUID] = _est_fk()
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patient.id"), index=True)
    kind: Mapped[str] = mapped_column(String(20))  # access | rectification | opposition | deletion
    message: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="open")  # open | done | rejected
    resolution: Mapped[str] = mapped_column(Text, default="")
    resolved_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_now)
    resolved_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Invitation(Base):
    """Lien d'accès patient à usage limité : seul le hash du jeton est stocké."""
    __tablename__ = "invitation"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    establishment_id: Mapped[uuid.UUID] = _est_fk()
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patient.id"), index=True)
    journey_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patient_journey.id"))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_now)


class StoredFile(Base):
    """Contenu chiffré (Fernet) d'un fichier patient, quand le backend de stockage est « db »."""
    __tablename__ = "stored_file"
    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    data: Mapped[bytes] = mapped_column(LargeBinary)


class Document(Base):
    __tablename__ = "document"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    establishment_id: Mapped[uuid.UUID] = _est_fk()
    journey_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patient_journey.id"), index=True)
    task_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("task.id"), index=True)
    filename: Mapped[str] = mapped_column(String(200))
    content_type: Mapped[str] = mapped_column(String(60))
    size: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    storage_key: Mapped[str] = mapped_column(String(80))
    uploaded_by: Mapped[str] = mapped_column(String(20), default="patient")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_now)


class MessageLog(Base):
    """Journal des envois (SMS / WhatsApp / e-mail) : preuve de ce qui est parti, et à qui (numéro masqué)."""
    __tablename__ = "message_log"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    establishment_id: Mapped[uuid.UUID] = _est_fk()
    journey_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("patient_journey.id"), nullable=True, index=True)
    patient_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("patient.id"), nullable=True)
    kind: Mapped[str] = mapped_column(String(30))  # reminder | invitation | info
    channel: Mapped[str] = mapped_column(String(10))
    to_masked: Mapped[str] = mapped_column(String(60), default="")
    subject: Mapped[str] = mapped_column(String(200), default="")
    status: Mapped[str] = mapped_column(String(12))  # simulated | sent | failed
    provider_ref: Mapped[str] = mapped_column(String(80), default="")
    error: Mapped[str] = mapped_column(String(300), default="")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_now)


class DocumentReading(Base):
    """Local OCR report, encrypted like the source document. Never auto-validates a task."""
    __tablename__ = "document_reading"
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("document.id"), primary_key=True)
    establishment_id: Mapped[uuid.UUID] = _est_fk()
    encrypted_report: Mapped[bytes] = mapped_column(LargeBinary)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_now)


class ActionPlan(Base):
    __tablename__ = "action_plan"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    establishment_id: Mapped[uuid.UUID] = _est_fk()
    actor: Mapped[str] = mapped_column(String(100))
    intent: Mapped[str] = mapped_column(String(30))
    payload: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(20), default="preview")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_now)


class ProcedureCard(Base):
    __tablename__ = "procedure_card"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    establishment_id: Mapped[uuid.UUID] = _est_fk()
    topic: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(200))
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    content: Mapped[dict] = mapped_column(JSON)  # fr / darija, controlled administrative procedures
    approved_by: Mapped[str | None] = mapped_column(String(100), nullable=True)


class SupportRequest(Base):
    __tablename__ = "support_request"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    establishment_id: Mapped[uuid.UUID] = _est_fk()
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patient.id"), index=True)
    encrypted_message: Mapped[bytes] = mapped_column(LargeBinary)
    status: Mapped[str] = mapped_column(String(20), default="open")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_now)

# Administrative operations: additive, no clinical decision data.
class TeamMember(Base):
    __tablename__ = "team_member"
    __table_args__ = (UniqueConstraint('establishment_id','subject'),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    establishment_id: Mapped[uuid.UUID] = _est_fk()
    subject: Mapped[str] = mapped_column(String(100))
    display_name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(20), default="coordinator")
    department: Mapped[str] = mapped_column(String(100), default="Admissions")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    available: Mapped[bool] = mapped_column(Boolean, default=True)
    backup_subject: Mapped[str] = mapped_column(String(100), default="")


class AdministrativeCase(Base):
    __tablename__ = "administrative_case"
    journey_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('patient_journey.id'), primary_key=True)
    establishment_id: Mapped[uuid.UUID] = _est_fk()
    assigned_subject: Mapped[str] = mapped_column(String(100), default="")
    department: Mapped[str] = mapped_column(String(100), default="Admissions")
    exception: Mapped[str] = mapped_column(String(40), default="")
    phase: Mapped[str] = mapped_column(String(20), default="preparing")
    revision: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_now)


class InsuranceCase(Base):
    __tablename__ = "insurance_case"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    establishment_id: Mapped[uuid.UUID] = _est_fk()
    journey_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('patient_journey.id'),index=True)
    insurer: Mapped[str] = mapped_column(String(120))
    reference: Mapped[str] = mapped_column(String(100),default="")
    status: Mapped[str] = mapped_column(String(30),default="draft")
    encrypted_note: Mapped[bytes] = mapped_column(LargeBinary)
    due_date: Mapped[dt.date | None] = mapped_column(Date,nullable=True)
    revision: Mapped[int] = mapped_column(Integer,default=1)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True),default=_now)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True),default=_now)


class AdministrativeEvent(Base):
    __tablename__ = "administrative_event"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True,default=uuid.uuid4)
    establishment_id: Mapped[uuid.UUID] = _est_fk()
    journey_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('patient_journey.id'),index=True)
    actor: Mapped[str] = mapped_column(String(100))
    kind: Mapped[str] = mapped_column(String(30))
    encrypted_text: Mapped[bytes] = mapped_column(LargeBinary)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True),default=_now)


class FinanceEntry(Base):
    __tablename__ = "finance_entry"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True,default=uuid.uuid4)
    establishment_id: Mapped[uuid.UUID] = _est_fk()
    journey_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('patient_journey.id'),index=True)
    kind: Mapped[str] = mapped_column(String(20))  # quote, coverage, deposit, refund, void
    amount_cents: Mapped[int] = mapped_column(Integer)
    reference: Mapped[str] = mapped_column(String(120),default="")
    actor: Mapped[str] = mapped_column(String(100))
    reverses_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey('finance_entry.id'),nullable=True,unique=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True),default=_now)


class SavedDraft(Base):
    __tablename__ = "saved_draft"
    __table_args__ = (UniqueConstraint('establishment_id','actor','key'),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True,default=uuid.uuid4)
    establishment_id: Mapped[uuid.UUID] = _est_fk()
    actor: Mapped[str] = mapped_column(String(100))
    key: Mapped[str] = mapped_column(String(100))
    encrypted_payload: Mapped[bytes] = mapped_column(LargeBinary)
    revision: Mapped[int] = mapped_column(Integer,default=1)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True),default=_now)


class TimeObservation(Base):
    __tablename__ = "time_observation"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True,default=uuid.uuid4)
    establishment_id: Mapped[uuid.UUID] = _est_fk()
    actor: Mapped[str] = mapped_column(String(100))
    cohort: Mapped[str] = mapped_column(String(10))
    activity: Mapped[str] = mapped_column(String(40))
    seconds: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True),default=_now)


class IntegrationConnection(Base):
    __tablename__ = "integration_connection"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True,default=uuid.uuid4)
    establishment_id: Mapped[uuid.UUID] = _est_fk()
    name: Mapped[str] = mapped_column(String(100))
    token_hash: Mapped[str] = mapped_column(String(64),unique=True)
    active: Mapped[bool] = mapped_column(Boolean,default=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True),default=_now)


class ExternalAdmission(Base):
    __tablename__ = "external_admission"
    __table_args__ = (UniqueConstraint('connection_id','external_id'),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True,default=uuid.uuid4)
    connection_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('integration_connection.id'))
    establishment_id: Mapped[uuid.UUID] = _est_fk()
    external_id: Mapped[str] = mapped_column(String(100))
    journey_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('patient_journey.id'))


class CompanionGrant(Base):
    __tablename__ = "companion_grant"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True,default=uuid.uuid4)
    establishment_id: Mapped[uuid.UUID] = _est_fk()
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('patient.id'),index=True)
    label: Mapped[str] = mapped_column(String(100))
    token_hash: Mapped[str] = mapped_column(String(64),unique=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean,default=False)
    attempts: Mapped[int] = mapped_column(Integer,default=0)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True),default=_now)


class Dispatch(Base):
    __tablename__ = "dispatch"
    __table_args__ = (UniqueConstraint('establishment_id','request_key'),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True,default=uuid.uuid4)
    establishment_id: Mapped[uuid.UUID] = _est_fk()
    journey_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('patient_journey.id'),index=True)
    request_key: Mapped[str] = mapped_column(String(80))
    message_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey('message_log.id'),nullable=True)
    encrypted_body: Mapped[bytes] = mapped_column(LargeBinary)
    status: Mapped[str] = mapped_column(String(20),default="draft")
    actor: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True),default=_now)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True),default=_now)

class FacilityPreferences(Base):
    __tablename__='facility_preferences'
    establishment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('establishment.id'),primary_key=True)
    support_phone: Mapped[str] = mapped_column(String(30),default='')
    support_email: Mapped[str] = mapped_column(String(200),default='')
    contact_start_hour: Mapped[int] = mapped_column(Integer,default=8)
    contact_end_hour: Mapped[int] = mapped_column(Integer,default=20)

class PatientContactPreference(Base):
    __tablename__='patient_contact_preference'
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('patient.id'),primary_key=True)
    establishment_id: Mapped[uuid.UUID] = _est_fk()
    enabled: Mapped[bool] = mapped_column(Boolean,default=True)
