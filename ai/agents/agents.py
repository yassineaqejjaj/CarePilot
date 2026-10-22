"""Quatre agents spécialisés. Chacun : entrées minimales, sorties typées, aucune écriture directe.

Les agents retournent des résultats ; l'application les transforme en `AIProposal` soumises
à validation humaine. Aucun agent ne change un statut de dossier.
"""
from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field

from ai import prompts
from ai.guardrails import medical_advice_terms, redact
from ai.providers.base import AIProvider, CallContext, GuardrailError
from ai.rag.service import RagService, format_context


# ---------------------------------------------------------------- Administrative
class VerificationOutput(BaseModel):
    anomalies: list[str] = Field(default_factory=list)
    summary: str


class VerificationResult(BaseModel):
    missing_documents: list[str]  # calculé de façon déterministe, pas par le LLM
    anomalies: list[str]
    summary: str


class AdministrativeAgent:
    name = "administrative"

    def __init__(self, provider: AIProvider, rag: RagService):
        self.provider, self.rag = provider, rag

    def run(self, ctx: CallContext, *, required_docs: list[str], received_docs: list[str],
            days_to_surgery: int, journey_ref: str) -> VerificationResult:
        missing = [d for d in required_docs if d not in received_docs]
        passages = self.rag.retrieve(ctx, "documents administratifs requis avant intervention")
        user_input = (
            f"Dossier {journey_ref}\nJours avant intervention : {days_to_surgery}\n"
            f"Documents requis : {required_docs}\nDocuments reçus : {received_docs}\n"
            f"Documents manquants (calculés) : {missing}\n\nProcédures :\n{format_context(passages)}"
        )
        out = self.provider.generate_structured(ctx, instructions=prompts.ADMIN_VERIFY, user_input=user_input,
                                                schema=VerificationOutput)
        return VerificationResult(missing_documents=missing, anomalies=out.anomalies, summary=out.summary)


# ---------------------------------------------------------------- Communication
class DraftOutput(BaseModel):
    subject: str
    body: str  # peut contenir {{patient_first_name}}


class DraftMessage(BaseModel):
    subject: str
    body: str
    requires_validation: bool = True


class CommunicationAgent:
    name = "communication"

    def __init__(self, provider: AIProvider, rag: RagService):
        self.provider, self.rag = provider, rag

    def run(self, ctx: CallContext, *, approved_template: str, purpose: str,
            variables: dict[str, str]) -> DraftMessage:
        """`variables` (ex. prénom) sont substituées localement APRÈS l'appel LLM."""
        passages = self.rag.retrieve(ctx, purpose)
        user_input = f"Objectif : {purpose}\nModèle approuvé :\n{approved_template}\n\nProcédures :\n{format_context(passages)}"
        out = self.provider.generate_structured(ctx, instructions=prompts.COMMUNICATE, user_input=user_input,
                                                schema=DraftOutput)
        if bad := medical_advice_terms(out.subject + " " + out.body):
            raise GuardrailError(f"Contenu médical détecté dans le brouillon : {bad}")
        body, subject = out.body, out.subject
        for k, v in variables.items():
            body, subject = body.replace("{{" + k + "}}", v), subject.replace("{{" + k + "}}", v)
        return DraftMessage(subject=subject, body=body)  # toujours soumis à validation dans le MVP


# ---------------------------------------------------------------- Follow-up
class ReplyCategory(str, Enum):
    confirmation = "confirmation"
    question = "question"
    document_sent = "document_sent"
    reschedule_or_cancel = "reschedule_or_cancel"
    other = "other"


class AllowedAction(str, Enum):
    send_reminder = "send_reminder"
    request_document = "request_document"
    notify_coordinator = "notify_coordinator"
    mark_for_call = "mark_for_call"


class FollowUpOutput(BaseModel):
    category: ReplyCategory
    remaining_steps: list[str] = Field(default_factory=list)
    proposed_actions: list[AllowedAction] = Field(default_factory=list)
    needs_human: bool = False


class FollowUpAgent:
    name = "followup"

    def __init__(self, provider: AIProvider):
        self.provider = provider

    def run(self, ctx: CallContext, *, patient_reply: str, open_tasks: list[str]) -> FollowUpOutput:
        clean, found = redact(patient_reply)  # e-mails/téléphones/NIR retirés avant envoi
        user_input = (f"Réponse du patient (redacted: {found}) :\n{clean}\n\nDémarches ouvertes : {open_tasks}\n"
                      f"Actions autorisées : {[a.value for a in AllowedAction]}")
        out = self.provider.generate_structured(ctx, instructions=prompts.FOLLOWUP, user_input=user_input,
                                                schema=FollowUpOutput)
        if out.category in (ReplyCategory.question, ReplyCategory.other) and found:
            out.needs_human = True
        return out


# ---------------------------------------------------------------- Summary
class SummaryOutput(BaseModel):
    facts: list[str]
    blockers: list[str] = Field(default_factory=list)
    next_steps: list[str] = Field(default_factory=list)


class SummaryAgent:
    name = "summary"

    def __init__(self, provider: AIProvider):
        self.provider = provider

    def run(self, ctx: CallContext, *, events: list[str]) -> SummaryOutput:
        clean = [redact(e)[0] for e in events]
        return self.provider.generate_structured(ctx, instructions=prompts.SUMMARY,
                                                 user_input="Événements :\n" + "\n".join(f"- {e}" for e in clean),
                                                 schema=SummaryOutput)
