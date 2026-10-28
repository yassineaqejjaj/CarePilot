"""Conformité loi 09-08 (Maroc) : notice d'information, consentement, droits des personnes, conservation.

Références : loi n° 09-08 (art. 4-5 consentement et information, art. 7-9 droits d'accès/rectification/opposition),
délibération CNDP D-941-2025 sur le suivi des patients (autorisation préalable, information, conservation limitée).
Ce module met en œuvre des mécanismes ; il ne remplace ni l'autorisation CNDP ni un avis juridique.
"""
from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models as m
from app import storage

NOTICE_VERSION = "2026-10"


def notice(est: m.Establishment) -> dict:
    """Contenu de la notice (art. 5 loi 09-08 / D-941-2025 §8). Textes localisés côté interface."""
    return {
        "version": NOTICE_VERSION, "controller": est.name, "city": est.city,
        "rights_contact": est.dpo_contact, "cndp_ref": est.cndp_ref, "transfer_ref": est.cndp_transfer_ref,
        "retention_days": est.retention_days,
    }


def has_consent(db: Session, patient_id: uuid.UUID) -> bool:
    return db.scalar(select(m.Consent.id).where(m.Consent.patient_id == patient_id,
                                                m.Consent.notice_version == NOTICE_VERSION).limit(1)) is not None


def record_consent(db: Session, est_id: uuid.UUID, patient_id: uuid.UUID, channel: str = "portal") -> m.Consent:
    c = m.Consent(establishment_id=est_id, patient_id=patient_id, notice_version=NOTICE_VERSION, channel=channel)
    db.add(c)
    return c


def anonymize_patient(db: Session, patient: m.Patient) -> None:
    """Efface les données identifiantes et les pièces ; conserve la trace du consentement et du journal masqué."""
    journeys = db.scalars(select(m.PatientJourney).where(m.PatientJourney.patient_id == patient.id)).all()
    for j in journeys:
        for doc in db.scalars(select(m.Document).where(m.Document.journey_id == j.id)).all():
            report = db.get(m.DocumentReading, doc.id)
            if report:
                db.delete(report)
            storage.delete_file(db, doc)
            db.delete(doc)
        for t in j.tasks:
            t.response = None
        for inv in db.scalars(select(m.Invitation).where(m.Invitation.journey_id == j.id)).all():
            db.delete(inv)
    from app import operations as ops
    for j in journeys:
        for r in db.scalars(select(m.AdministrativeEvent).where(m.AdministrativeEvent.journey_id==j.id)):
            r.encrypted_text=ops.encrypt("Contenu supprimé lors de l’archivage du patient")
        for r in db.scalars(select(m.Dispatch).where(m.Dispatch.journey_id==j.id)):
            r.encrypted_body=ops.encrypt("Contenu supprimé lors de l’archivage du patient")
        for r in db.scalars(select(m.InsuranceCase).where(m.InsuranceCase.journey_id==j.id)):
            r.reference="";r.encrypted_note=ops.encrypt("")
        for r in db.scalars(select(m.FinanceEntry).where(m.FinanceEntry.journey_id==j.id)):
            r.reference="Référence anonymisée"
        for t in j.tasks:t.detail=""
    pref=db.get(m.PatientContactPreference,patient.id)
    if pref:pref.enabled=False
    for r in db.scalars(select(m.CompanionGrant).where(m.CompanionGrant.patient_id==patient.id)):
        r.revoked=True;r.label="Accompagnant archivé"
    # Drafts are encrypted, scoped to their author and scrubbed if they contain this identity.
    identifiers=[v.lower() for v in (patient.phone,patient.email,patient.first_name+' '+patient.last_name) if v]
    for draft in db.scalars(select(m.SavedDraft).where(m.SavedDraft.establishment_id==patient.establishment_id)).all():
        payload=__import__('json').dumps(ops.decrypt(draft.encrypted_payload),ensure_ascii=False).lower()
        data=ops.decrypt(draft.encrypted_payload)
        if any(v in payload for v in identifiers) or (data.get('first_name')==patient.first_name and data.get('last_name')==patient.last_name):db.delete(draft)
    for request in db.scalars(select(m.SupportRequest).where(m.SupportRequest.patient_id == patient.id)).all():
        db.delete(request)
    # Prepared action plans may contain locally rendered names/messages.
    for plan in db.scalars(select(m.ActionPlan).where(m.ActionPlan.establishment_id == patient.establishment_id)).all():
        if any(i.get("journey_id") in {str(j.id) for j in journeys} for i in plan.payload.get("items", [])):
            db.delete(plan)
    patient.first_name, patient.last_name = "Patient", "archivé"
    patient.email = patient.phone = ""
    patient.birth_date = None
    patient.anonymized_at = dt.datetime.now(dt.timezone.utc)


def purge_expired(db: Session, now: dt.datetime | None = None, est_id: uuid.UUID | None = None, dry_run: bool = False) -> int:
    """Anonymise les patients dont TOUS les parcours sont clos depuis plus de `retention_days`."""
    now = now or dt.datetime.now(dt.timezone.utc)
    q = select(m.Patient).where(m.Patient.anonymized_at.is_(None))
    if est_id:
        q = q.where(m.Patient.establishment_id == est_id)
    if not dry_run:
        drafts=select(m.SavedDraft).where(m.SavedDraft.updated_at < now-dt.timedelta(days=30))
        if est_id:drafts=drafts.where(m.SavedDraft.establishment_id==est_id)
        for draft in db.scalars(drafts).all():db.delete(draft)
    count = 0
    for pat in db.scalars(q).all():
        est = db.get(m.Establishment, pat.establishment_id)
        journeys = db.scalars(select(m.PatientJourney).where(m.PatientJourney.patient_id == pat.id)).all()
        if not journeys or any(j.status != "completed" or j.completed_at is None for j in journeys):
            continue
        limit = now - dt.timedelta(days=est.retention_days)
        if all((j.completed_at if j.completed_at.tzinfo else j.completed_at.replace(tzinfo=dt.timezone.utc)) < limit for j in journeys):
            count += 1
            if not dry_run:
                anonymize_patient(db, pat)
    return count


def export_patient_data(db: Session, patient: m.Patient) -> dict:
    """Droit d'accès : toutes les données détenues sur le patient, sous forme lisible."""
    journeys = db.scalars(select(m.PatientJourney).where(m.PatientJourney.patient_id == patient.id)).all()
    from app import operations as ops
    return {
        "patient": {"first_name": patient.first_name, "last_name": patient.last_name, "birth_date": patient.birth_date.isoformat() if patient.birth_date else None,
                    "phone": patient.phone, "email": patient.email, "language": patient.language, "reference": patient.ref, "administrative_reminders_enabled": (db.get(m.PatientContactPreference,patient.id).enabled if db.get(m.PatientContactPreference,patient.id) else True)},
        "journeys": [{
            "reference": j.reference, "procedure": j.procedure, "surgery_date": j.surgery_date.isoformat(), "status": j.status,
            "administrative_messages": [{"status":r.status,"body":ops.decrypt(r.encrypted_body)} for r in db.scalars(select(m.Dispatch).where(m.Dispatch.journey_id==j.id))],
            "administrative_events": [{"kind":r.kind,"text":ops.decrypt(r.encrypted_text)} for r in db.scalars(select(m.AdministrativeEvent).where(m.AdministrativeEvent.journey_id==j.id))],
            "insurance": [{"insurer":r.insurer,"reference":r.reference,"status":r.status,"note":ops.decrypt(r.encrypted_note)} for r in db.scalars(select(m.InsuranceCase).where(m.InsuranceCase.journey_id==j.id))],
            "financial_administration": ops.finances(db,j.id),
            "tasks": [{"title": t.title, "due_date": t.due_date.isoformat(), "status": t.status} for t in j.tasks],
            "documents": [{"filename": d.filename, "size": d.size, "uploaded_at": d.created_at.isoformat()}
                          for d in db.scalars(select(m.Document).where(m.Document.journey_id == j.id)).all()],
            "messages": [{"channel": x.channel, "kind": x.kind, "status": x.status, "at": x.created_at.isoformat()}
                         for x in db.scalars(select(m.MessageLog).where(m.MessageLog.journey_id == j.id)).all()],
        } for j in journeys],
        "support_requests": [{"status": r.status, "created_at": r.created_at.isoformat(),
                              "message": storage._fernet().decrypt(r.encrypted_message).decode()}
                             for r in db.scalars(select(m.SupportRequest).where(m.SupportRequest.patient_id == patient.id)).all()],
        "consents": [{"version": c.notice_version, "given_at": c.given_at.isoformat(), "channel": c.channel}
                     for c in db.scalars(select(m.Consent).where(m.Consent.patient_id == patient.id)).all()],
    }
