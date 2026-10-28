"""Tenant-scoped administrative workflows. All sensitive actions require staff confirmation."""

from __future__ import annotations
import datetime as dt
import hashlib
import hmac
import json
import secrets
import uuid
from typing import Literal
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import select, update
from sqlalchemy.orm import Session
from app import models as m, services as svc, intake, messaging, compliance, storage
from app import operations as o
from app.core import (
    Principal,
    PORTAL_ISSUER,
    get_settings,
    get_db,
    require_roles,
    today,
)
from app.routers.portal import _patient, _need_consent

router = APIRouter(prefix="/operations")
Staff = Depends(require_roles("admin", "coordinator", "designer", "viewer"))
Coord = Depends(require_roles("admin", "coordinator"))
Admin = Depends(require_roles("admin"))
Patient = Depends(require_roles("patient"))


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


def scoped(db, model, id, p):
    return svc.get_scoped(db, model, id, p)


def rows(db, model, p):
    return db.scalars(
        select(model).where(model.establishment_id == p.establishment_id)
    ).all()


def lock_journey(db, p, jid):
    j = scoped(db, m.PatientJourney, jid, p)
    db.execute(
        select(m.PatientJourney.id).where(m.PatientJourney.id == j.id).with_for_update()
    )
    return j


def member_json(r):
    return o.serial(
        r, "id subject display_name role department active available backup_subject"
    )


@router.get("/team")
def team(p: Principal = Staff, db: Session = Depends(get_db)):
    items = [member_json(r) for r in rows(db, m.TeamMember, p)]
    if not any(r["subject"] == p.sub for r in items):
        items.insert(
            0,
            {
                "id": None,
                "subject": p.sub,
                "display_name": p.name or "Mon compte",
                "role": next(iter(p.roles)),
                "department": "Admissions",
                "active": True,
                "available": True,
                "backup_subject": "",
            },
        )
    return {
        "items": items,
        "notice": "Le compte doit exister dans Keycloak. Ce registre applique les restrictions d’accès ; il ne crée aucun mot de passe.",
    }


class MemberIn(Input):
    subject: str = Field(min_length=1, max_length=100)
    display_name: str = Field(min_length=1, max_length=120)
    role: Literal["admin", "coordinator", "designer", "viewer"] = "coordinator"
    department: str = Field(default="Admissions", min_length=1, max_length=100)
    active: bool = True
    available: bool = True
    backup_subject: str = Field(default="", max_length=100)


@router.put("/team")
def set_member(b: MemberIn, p: Principal = Admin, db: Session = Depends(get_db)):
    if b.subject == p.sub and (not b.active or b.role != "admin"):
        raise HTTPException(
            409, "Vous ne pouvez pas supprimer votre propre accès administrateur"
        )
    if b.backup_subject:
        backup = db.scalar(
            select(m.TeamMember).where(
                m.TeamMember.establishment_id == p.establishment_id,
                m.TeamMember.subject == b.backup_subject,
                m.TeamMember.active.is_(True),
            )
        )
        if not backup or b.backup_subject == b.subject:
            raise HTTPException(422, "Remplaçant actif du même établissement requis")
    r = db.scalar(
        select(m.TeamMember).where(
            m.TeamMember.establishment_id == p.establishment_id,
            m.TeamMember.subject == b.subject,
        )
    )
    if not r:
        r = m.TeamMember(establishment_id=p.establishment_id, **b.model_dump())
        db.add(r)
    else:
        for k, v in b.model_dump().items():
            setattr(r, k, v)
    svc.audit(db, p, "team.update", "team_member", b.subject)
    db.commit()
    return member_json(r)


@router.get("/worklist")
def worklist(p: Principal = Staff, db: Session = Depends(get_db)):
    return {
        "items": o.worklist(db, p),
        "messaging_provider": get_settings().messaging_provider,
        "scope": "Priorités administratives uniquement. Aucune priorisation médicale.",
    }


@router.get("/cases/{jid}")
def case(jid: uuid.UUID, p: Principal = Staff, db: Session = Depends(get_db)):
    j = scoped(db, m.PatientJourney, jid, p)
    c = db.get(m.AdministrativeCase, jid)
    events = db.scalars(
        select(m.AdministrativeEvent)
        .where(m.AdministrativeEvent.journey_id == jid)
        .order_by(m.AdministrativeEvent.created_at.desc())
        .limit(100)
    ).all()
    pat = db.get(m.Patient, j.patient_id)
    support = db.scalars(
        select(m.SupportRequest).where(
            m.SupportRequest.patient_id == pat.id,
            m.SupportRequest.establishment_id == p.establishment_id,
        )
    ).all()
    insurance = db.scalars(
        select(m.InsuranceCase).where(m.InsuranceCase.journey_id == jid)
    ).all()
    return {
        "id": str(jid),
        "reference": j.reference,
        "revision": c.revision if c else 0,
        "assigned_subject": c.assigned_subject if c else "",
        "department": c.department if c else "Admissions",
        "exception": c.exception if c else "",
        "phase": c.phase if c else "preparing",
        "finance": o.finances(db, jid),
        "insurance": [
            {
                **o.serial(
                    r,
                    "id insurer reference status due_date revision created_at updated_at",
                ),
                "note": o.decrypt(r.encrypted_note),
            }
            for r in insurance
        ],
        "events": [
            {
                **o.serial(r, "id actor kind created_at"),
                "text": o.decrypt(r.encrypted_text),
            }
            for r in events
        ],
        "support": [
            {
                **o.serial(r, "id status created_at"),
                "message": storage._fernet().decrypt(r.encrypted_message).decode(),
            }
            for r in support
        ],
        "preparation": {
            "missing": sum(t.blocking and t.status != "done" for t in j.tasks),
            "submitted": sum(t.status == "submitted" for t in j.tasks),
        },
        "patient": {
            "id": str(pat.id),
            "name": pat.first_name + " " + pat.last_name,
            "phone": pat.phone,
            "email": pat.email,
        },
    }


class CaseIn(Input):
    revision: int = Field(ge=0)
    assigned_subject: str = Field(default="", max_length=100)
    department: str = Field(default="Admissions", min_length=1, max_length=100)
    exception: Literal[
        "",
        "no_smartphone",
        "unreadable_document",
        "insurance_wait",
        "rescheduled",
        "contact_issue",
    ] = ""
    phase: Literal["preparing", "ready", "arrived", "closed"] = "preparing"


@router.put("/cases/{jid}")
def update_case(
    jid: uuid.UUID, b: CaseIn, p: Principal = Coord, db: Session = Depends(get_db)
):
    j = lock_journey(db, p, jid)
    r = db.get(m.AdministrativeCase, jid)
    if (r.revision if r else 0) != b.revision:
        raise HTTPException(
            409, "Dossier modifié par une autre personne. Rechargez avant de confirmer."
        )
    if b.phase == "ready" and any(t.blocking and t.status != "done" for t in j.tasks):
        raise HTTPException(
            409,
            "Des pièces administratives restent à valider. L’accueil reste possible sans ce statut.",
        )
    if b.assigned_subject and b.assigned_subject != p.sub:
        owner = db.scalar(
            select(m.TeamMember).where(
                m.TeamMember.establishment_id == p.establishment_id,
                m.TeamMember.subject == b.assigned_subject,
                m.TeamMember.active.is_(True),
            )
        )
        if not owner:
            raise HTTPException(422, "Responsable actif du même établissement requis")
    if b.assigned_subject:
        selected = db.scalar(
            select(m.TeamMember).where(
                m.TeamMember.establishment_id == p.establishment_id,
                m.TeamMember.subject == b.assigned_subject,
            )
        )
        j.owner = selected.display_name if selected else p.name or p.email
    else:
        j.owner = ""
    for task in j.tasks:
        if task.status != "done":
            task.owner = j.owner or None
    values = b.model_dump(exclude={"revision"})
    if not r:
        r = m.AdministrativeCase(
            journey_id=jid, establishment_id=p.establishment_id, revision=1, **values
        )
        db.add(r)
    else:
        for k, v in values.items():
            setattr(r, k, v)
        r.revision += 1
        r.updated_at = o.stamp()
    o.event(
        db,
        p,
        jid,
        "handoff",
        {
            "department": b.department,
            "owner": b.assigned_subject,
            "phase": b.phase,
            "exception": b.exception,
        },
    )
    db.commit()
    return {"revision": r.revision}


class NoteIn(Input):
    text: str = Field(min_length=1, max_length=2000)


@router.post("/cases/{jid}/notes")
def note(
    jid: uuid.UUID, b: NoteIn, p: Principal = Coord, db: Session = Depends(get_db)
):
    scoped(db, m.PatientJourney, jid, p)
    o.event(db, p, jid, "note", b.text)
    db.commit()
    return {"ok": True}


class DateIn(Input):
    date: dt.date
    reason: str = Field(min_length=3, max_length=500)


@router.post("/cases/{jid}/reschedule")
def reschedule(
    jid: uuid.UUID, b: DateIn, p: Principal = Coord, db: Session = Depends(get_db)
):
    j = lock_journey(db, p, jid)
    if j.status != "active":
        raise HTTPException(409, "Parcours non actif")
    old = j.surgery_date
    delta = b.date - old
    j.surgery_date = b.date
    for t in j.tasks:
        if t.status != "done":
            t.due_date += delta
    o.event(
        db,
        p,
        jid,
        "reschedule",
        {"from": str(old), "to": str(b.date), "reason": b.reason},
    )
    db.commit()
    return {"date": str(b.date)}


class InsuranceIn(Input):
    insurer: str = Field(min_length=1, max_length=120)
    reference: str = Field(default="", max_length=100)
    due_date: dt.date | None = None
    note: str = Field(default="", max_length=2000)


@router.post("/cases/{jid}/insurance", status_code=201)
def insurance_create(
    jid: uuid.UUID, b: InsuranceIn, p: Principal = Coord, db: Session = Depends(get_db)
):
    scoped(db, m.PatientJourney, jid, p)
    r = m.InsuranceCase(
        establishment_id=p.establishment_id,
        journey_id=jid,
        insurer=b.insurer,
        reference=b.reference,
        due_date=b.due_date,
        encrypted_note=o.encrypt(b.note),
    )
    db.add(r)
    o.event(
        db,
        p,
        jid,
        "insurance",
        "Demande créée ; à vérifier avant transmission externe.",
    )
    db.commit()
    return {"id": str(r.id), "revision": r.revision}


class InsuranceUpdate(Input):
    revision: int = Field(ge=1)
    status: Literal["draft", "submitted", "more_info", "approved", "rejected"]
    note: str = Field(default="", max_length=2000)


@router.put("/insurance/{id}")
def insurance_update(
    id: uuid.UUID,
    b: InsuranceUpdate,
    p: Principal = Coord,
    db: Session = Depends(get_db),
):
    r = scoped(db, m.InsuranceCase, id, p)
    lock_journey(db, p, r.journey_id)
    db.refresh(r)
    if r.revision != b.revision:
        raise HTTPException(409, "Demande modifiée : rechargez")
    transitions = {
        "draft": {"submitted"},
        "submitted": {"more_info", "approved", "rejected"},
        "more_info": {"submitted", "approved", "rejected"},
        "approved": set(),
        "rejected": {"draft"},
    }
    if b.status not in transitions[r.status]:
        raise HTTPException(409, "Transition non autorisée")
    r.status = b.status
    r.encrypted_note = o.encrypt(b.note)
    r.revision += 1
    r.updated_at = o.stamp()
    o.event(db, p, r.journey_id, "insurance", {"id": str(r.id), "status": b.status})
    db.commit()
    return {"revision": r.revision}


class FinanceIn(Input):
    kind: Literal["quote", "coverage", "deposit", "refund"]
    amount_cents: int = Field(gt=0, le=100_000_000)
    reference: str = Field(min_length=1, max_length=120)
    confirmed: Literal[True]


@router.post("/cases/{jid}/finance", status_code=201)
def finance(
    jid: uuid.UUID, b: FinanceIn, p: Principal = Coord, db: Session = Depends(get_db)
):
    lock_journey(db, p, jid)
    f = o.finances(db, jid)
    if b.kind == "quote" and f["quote"]:
        raise HTTPException(409, "Annulez le devis précédent avant de le remplacer")
    if b.kind == "coverage" and (
        not f["quote"] or f["coverage"] + b.amount_cents > f["quote"]
    ):
        raise HTTPException(422, "Couverture supérieure au devis ou devis absent")
    if b.kind == "refund" and b.amount_cents > f["net_deposits"]:
        raise HTTPException(422, "Remboursement supérieur aux acomptes enregistrés")
    r = m.FinanceEntry(
        establishment_id=p.establishment_id,
        journey_id=jid,
        actor=p.sub,
        **b.model_dump(exclude={"confirmed"}),
    )
    db.add(r)
    o.event(db, p, jid, "finance", {"kind": b.kind, "amount_cents": b.amount_cents})
    db.commit()
    return o.finances(db, jid)


class VoidIn(Input):
    reason: str = Field(min_length=3, max_length=200)


@router.post("/finance/{id}/void")
def void(id: uuid.UUID, b: VoidIn, p: Principal = Admin, db: Session = Depends(get_db)):
    r = scoped(db, m.FinanceEntry, id, p)
    lock_journey(db, p, r.journey_id)
    f = o.finances(db, r.journey_id)
    if r.kind == "void" or any(x["reverses_id"] == str(id) for x in f["entries"]):
        raise HTTPException(409, "Écriture déjà annulée")
    if r.kind == "deposit" and f["net_deposits"] < r.amount_cents:
        raise HTTPException(409, "Annulez d’abord les remboursements associés")
    if r.kind == "quote" and f["coverage"]:
        raise HTTPException(409, "Annulez d’abord la couverture associée")
    db.add(
        m.FinanceEntry(
            establishment_id=p.establishment_id,
            journey_id=r.journey_id,
            kind="void",
            amount_cents=r.amount_cents,
            reference=b.reason,
            actor=p.sub,
            reverses_id=id,
        )
    )
    o.event(db, p, r.journey_id, "finance", {"void": str(id)})
    db.commit()
    return o.finances(db, r.journey_id)


class DraftIn(Input):
    revision: int = Field(ge=0)
    payload: dict


@router.get("/drafts/{key}")
def draft_get(key: str, p: Principal = Coord, db: Session = Depends(get_db)):
    r = db.scalar(
        select(m.SavedDraft).where(
            m.SavedDraft.establishment_id == p.establishment_id,
            m.SavedDraft.actor == p.sub,
            m.SavedDraft.key == key,
        )
    )
    return (
        {"revision": r.revision, "payload": o.decrypt(r.encrypted_payload)}
        if r
        else {"revision": 0, "payload": None}
    )


@router.put("/drafts/{key}")
def draft_put(
    key: str, b: DraftIn, p: Principal = Coord, db: Session = Depends(get_db)
):
    if len(key) > 80 or len(json.dumps(b.payload)) > 20000:
        raise HTTPException(422, "Brouillon trop volumineux")
    r = db.scalar(
        select(m.SavedDraft).where(
            m.SavedDraft.establishment_id == p.establishment_id,
            m.SavedDraft.actor == p.sub,
            m.SavedDraft.key == key,
        )
    )
    if not r:
        if b.revision:
            raise HTTPException(409, "Brouillon remplacé")
        r = m.SavedDraft(
            establishment_id=p.establishment_id,
            actor=p.sub,
            key=key,
            encrypted_payload=o.encrypt(b.payload),
        )
        db.add(r)
        try:
            db.commit()
        except __import__("sqlalchemy").exc.IntegrityError:
            db.rollback()
            raise HTTPException(409, "Brouillon modifié ailleurs")
        return {"revision": 1}
    result = db.execute(
        update(m.SavedDraft)
        .where(m.SavedDraft.id == r.id, m.SavedDraft.revision == b.revision)
        .values(
            encrypted_payload=o.encrypt(b.payload),
            revision=b.revision + 1,
            updated_at=o.stamp(),
        )
    )
    if result.rowcount != 1:
        raise HTTPException(409, "Brouillon modifié ailleurs. Rechargez sans écraser.")
    db.commit()
    return {"revision": b.revision + 1}


@router.delete("/drafts/{key}")
def draft_delete(key: str, p: Principal = Coord, db: Session = Depends(get_db)):
    r = db.scalar(
        select(m.SavedDraft).where(
            m.SavedDraft.establishment_id == p.establishment_id,
            m.SavedDraft.actor == p.sub,
            m.SavedDraft.key == key,
        )
    )
    if r:
        db.delete(r)
        db.commit()
    return {"ok": True}


class DuplicateIn(Input):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    birth_date: str = Field(default="", max_length=20)


@router.post("/duplicates")
def duplicates(b: DuplicateIn, p: Principal = Coord, db: Session = Depends(get_db)):
    first_name, last_name, birth_date = b.first_name, b.last_name, b.birth_date
    import unicodedata, re

    def normalized(v):
        return (
            re.sub(
                r"\W",
                "",
                unicodedata.normalize("NFKD", v.lower())
                .encode("ascii", "ignore")
                .decode(),
            )
            if v.isascii() or any("LATIN" in unicodedata.name(c, "") for c in v)
            else re.sub(r"\W", "", v)
        )

    if not first_name.strip() or not last_name.strip():
        return {"items": []}
    bd = (
        __import__("app.moroccan", fromlist=["parse_birth_date"]).parse_birth_date(
            birth_date
        )
        if birth_date
        else None
    )
    found = [
        r
        for r in rows(db, m.Patient, p)
        if not r.anonymized_at
        and normalized(r.first_name) == normalized(first_name)
        and normalized(r.last_name) == normalized(last_name)
        and (not bd or r.birth_date == bd)
    ]
    return {
        "items": [
            o.serial(r, "id first_name last_name birth_date ref") for r in found[:20]
        ],
        "notice": "Correspondances possibles uniquement. Réutilisation après vérification humaine ; aucune fusion automatique.",
    }


class ObservationIn(Input):
    cohort: Literal["baseline", "pilot"]
    activity: Literal[
        "document_check", "admission", "insurance", "reminder", "phone_call"
    ]
    seconds: int = Field(ge=1, le=86400)


@router.post("/observations")
def observation(b: ObservationIn, p: Principal = Coord, db: Session = Depends(get_db)):
    db.add(
        m.TimeObservation(
            establishment_id=p.establishment_id, actor=p.sub, **b.model_dump()
        )
    )
    db.commit()
    return {"ok": True}


@router.get("/metrics")
def metrics(p: Principal = Staff, db: Session = Depends(get_db)):
    return o.measures(db, p.establishment_id)


@router.get("/sites")
def sites(p: Principal = Staff, db: Session = Depends(get_db)):
    return {
        "current": str(p.establishment_id),
        "items": [
            {"id": str(e.id), "name": e.name, "metrics": o.measures(db, e.id)}
            for e in db.scalars(
                select(m.Establishment).where(
                    m.Establishment.id.in_(
                        p.authorized_establishments or (p.establishment_id,)
                    )
                )
            )
        ],
        "notice": "Seuls les établissements autorisés dans le jeton d’identité sont visibles.",
    }


class ConnectionIn(Input):
    name: str = Field(min_length=1, max_length=100)


@router.get("/connections")
def connections(p: Principal = Admin, db: Session = Depends(get_db)):
    return {
        "items": [
            o.serial(r, "id name active created_at")
            for r in rows(db, m.IntegrationConnection, p)
        ]
    }


@router.post("/connections", status_code=201)
def connection_create(
    b: ConnectionIn, p: Principal = Admin, db: Session = Depends(get_db)
):
    token = secrets.token_urlsafe(40)
    r = m.IntegrationConnection(
        establishment_id=p.establishment_id,
        name=b.name,
        token_hash=hashlib.sha256(token.encode()).hexdigest(),
    )
    db.add(r)
    svc.audit(db, p, "integration.create", "connection", b.name)
    db.commit()
    return {"id": str(r.id), "token": token}


@router.delete("/connections/{id}")
def connection_revoke(
    id: uuid.UUID, p: Principal = Admin, db: Session = Depends(get_db)
):
    r = scoped(db, m.IntegrationConnection, id, p)
    r.active = False
    svc.audit(db, p, "integration.revoke", "connection", id)
    db.commit()
    return {"ok": True}


def integration(request: Request, db: Session = Depends(get_db)):
    token = request.headers.get("X-Integration-Key", "")
    r = db.scalar(
        select(m.IntegrationConnection).where(
            m.IntegrationConnection.token_hash
            == hashlib.sha256(token.encode()).hexdigest(),
            m.IntegrationConnection.active.is_(True),
        )
    )
    if not r:
        raise HTTPException(401, "Connexion invalide")
    return r


from app.routers.core_routes import JourneyIn, _new_patient


class AdmissionIn(JourneyIn):
    model_config = ConfigDict(extra="forbid")
    external_id: str = Field(min_length=1, max_length=100)


@router.post("/exchange/admissions", status_code=201)
def admission(
    b: AdmissionIn,
    c: m.IntegrationConnection = Depends(integration),
    db: Session = Depends(get_db),
):
    db.execute(
        select(m.IntegrationConnection.id)
        .where(m.IntegrationConnection.id == c.id)
        .with_for_update()
    )
    db.refresh(c)
    if not c.active:
        raise HTTPException(401, "Connexion révoquée")
    prev = db.scalar(
        select(m.ExternalAdmission).where(
            m.ExternalAdmission.connection_id == c.id,
            m.ExternalAdmission.external_id == b.external_id,
        )
    )
    if prev:
        return {"id": str(prev.journey_id), "created": False}
    if b.patient_id or not b.patient:
        raise HTTPException(
            422,
            "Un nouveau patient administratif est requis ; aucune identité interne n’est acceptée ici",
        )
    p = Principal(
        "integration:" + str(c.id), c.establishment_id, frozenset({"coordinator"})
    )
    template = (
        scoped(db, m.JourneyTemplate, b.template_id, p) if b.template_id else None
    )
    pat = _new_patient(db, p, b.patient)
    j = intake.make_journey(
        db,
        p,
        pat,
        surgery_date=b.surgery_date,
        procedure=b.procedure,
        owner=b.owner,
        admission_time=b.admission_time,
        template=template,
    )
    db.add(
        m.ExternalAdmission(
            establishment_id=c.establishment_id,
            connection_id=c.id,
            external_id=b.external_id,
            journey_id=j.id,
        )
    )
    db.commit()
    return {"id": str(j.id), "created": True}


@router.get("/exchange/status")
def exchange_status(
    c: m.IntegrationConnection = Depends(integration), db: Session = Depends(get_db)
):
    out = []
    for r in db.scalars(
        select(m.ExternalAdmission).where(m.ExternalAdmission.connection_id == c.id)
    ):
        j = db.get(m.PatientJourney, r.journey_id)
        case = db.get(m.AdministrativeCase, j.id)
        out.append(
            {
                "external_id": r.external_id,
                "reference": j.reference,
                "administrative_phase": case.phase if case else "preparing",
                "complete": not any(t.blocking and t.status != "done" for t in j.tasks),
            }
        )
    return {"items": out, "scope": "Statuts administratifs uniquement"}


# Human-approved communications: persisted idempotency, encrypted content and verified delivery callbacks.
class DispatchIn(Input):
    request_key: str = Field(min_length=8, max_length=80)
    channel: Literal["auto", "email", "sms", "whatsapp"] = "auto"
    template: Literal["documents", "contact", "reminder"] = "documents"
    approved: Literal[True]


@router.get("/cases/{jid}/messages")
def thread(jid: uuid.UUID, p: Principal = Staff, db: Session = Depends(get_db)):
    scoped(db, m.PatientJourney, jid, p)
    return {
        "items": [
            {
                **o.serial(r, "id status created_at updated_at"),
                "body": o.decrypt(r.encrypted_body),
            }
            for r in db.scalars(
                select(m.Dispatch)
                .where(m.Dispatch.journey_id == jid)
                .order_by(m.Dispatch.created_at.desc())
            )
        ]
    }


@router.post("/cases/{jid}/messages")
def dispatch(
    jid: uuid.UUID, b: DispatchIn, p: Principal = Coord, db: Session = Depends(get_db)
):
    j = lock_journey(db, p, jid)
    pat = db.get(m.Patient, j.patient_id)
    prev = db.scalar(
        select(m.Dispatch).where(
            m.Dispatch.establishment_id == p.establishment_id,
            m.Dispatch.request_key == b.request_key,
        )
    )
    if prev:
        if prev.journey_id != jid:
            raise HTTPException(409, "Clé déjà utilisée pour un autre dossier")
        return o.serial(prev, "id status")
    if not compliance.has_consent(db, pat.id):
        raise HTTPException(409, "Accord patient requis avant un rappel")
    if j.status != "active" or pat.anonymized_at:
        raise HTTPException(409, "Parcours non actif")
    pref = db.get(m.PatientContactPreference, pat.id)
    if pref and not pref.enabled:
        raise HTTPException(
            409, "Le patient a désactivé les rappels ; utilisez un suivi humain adapté"
        )
    since = o.stamp() - dt.timedelta(hours=24)
    previous = db.scalar(
        select(m.Dispatch).where(
            m.Dispatch.journey_id == jid,
            m.Dispatch.created_at >= since,
            m.Dispatch.status.not_in(["failed", "inbound", "inbound_read"]),
        )
    )
    if previous:
        raise HTTPException(
            409,
            "Un message est déjà préparé ou transmis depuis moins de 24 h ; utilisez le suivi humain",
        )
    if get_settings().messaging_provider != "console":
        from zoneinfo import ZoneInfo

        hour = dt.datetime.now(ZoneInfo(get_settings().timezone)).hour
        prefs = db.get(m.FacilityPreferences, p.establishment_id)
        start = prefs.contact_start_hour if prefs else 8
        end = prefs.contact_end_hour if prefs else 20
        if not start <= hour < end:
            raise HTTPException(409, "Envoi possible de 08 h à 20 h, heure du Maroc")
    texts = {
        "fr": {
            "documents": "Une étape administrative vous attend dans votre espace personnel. Contactez votre établissement si vous avez besoin d’aide.",
            "contact": "Votre équipe souhaite faire le point avec vous. Merci de contacter le service des admissions.",
            "reminder": "Pensez à consulter les prochaines étapes dans votre espace personnel. Votre équipe reste disponible pour vous accompagner.",
        },
        "ar": {
            "documents": "خطوة إدارية تنتظركم في فضائكم الشخصي. تواصلوا مع مؤسستكم إذا احتجتم إلى مساعدة.",
            "contact": "يرغب فريقكم في التواصل معكم. يرجى الاتصال بمصلحة القبول.",
            "reminder": "يرجى مراجعة الخطوات المقبلة في فضائكم الشخصي. فريقكم متاح لمرافقتكم.",
        },
    }
    text = texts.get(pat.language, texts["fr"])[b.template]
    r = m.Dispatch(
        establishment_id=p.establishment_id,
        journey_id=jid,
        request_key=b.request_key,
        actor=p.sub,
        encrypted_body=o.encrypt(text),
        status="sending",
    )
    db.add(r)
    db.commit()  # Reserve the key before the network call: ambiguous transport failures are never retried automatically.
    msg = messaging.send_to_patient(
        db, p.establishment_id, pat, jid, "info", "M3aya Santé", text, b.channel
    )
    db.flush()
    r.message_id = msg.id
    r.status = msg.status
    if msg.channel == "whatsapp" and get_settings().messaging_provider == "brevo":
        r.encrypted_body = o.encrypt(
            "Modèle WhatsApp approuvé configuré chez Brevo ; contenu à consulter dans le compte fournisseur."
        )
    r.updated_at = o.stamp()
    o.event(db, p, jid, "message", {"id": str(r.id), "status": r.status})
    db.commit()
    return o.serial(r, "id status")


class ManualIn(Input):
    reason: str = Field(min_length=3, max_length=300)


@router.post("/messages/{id}/manual")
def manual_contact(
    id: uuid.UUID, b: ManualIn, p: Principal = Coord, db: Session = Depends(get_db)
):
    r = scoped(db, m.Dispatch, id, p)
    if r.status not in ("failed", "sending", "simulated"):
        raise HTTPException(409, "Une transmission a déjà été enregistrée")
    r.status = "manual"
    o.event(db, p, r.journey_id, "manual_contact", b.reason)
    db.commit()
    return {
        "status": "manual",
        "notice": "Transmission manuelle déclarée par l’équipe ; aucune livraison électronique attestée.",
    }


@router.post("/webhooks/brevo")
async def brevo_webhook(request: Request, db: Session = Depends(get_db)):
    secret = get_settings().messaging_webhook_secret
    if not secret or not hmac.compare_digest(
        request.headers.get("authorization", ""), "Bearer " + secret
    ):
        raise HTTPException(401, "Notification non authentifiée")
    raw = await request.body()
    if len(raw) > 64000:
        raise HTTPException(413, "Notification trop volumineuse")
    try:
        data = json.loads(raw)
    except ValueError:
        raise HTTPException(422, "JSON invalide")
    if not isinstance(data, dict):
        raise HTTPException(422, "Un événement par requête requis")
    reference = str(data.get("message-id") or data.get("messageId") or "")
    msg = (
        db.scalar(select(m.MessageLog).where(m.MessageLog.provider_ref == reference))
        if reference
        else None
    )
    if not msg or reference in ("console", "smtp"):
        return {"ok": True, "matched": False}
    mapping = {
        "delivered": "delivered",
        "hardBounce": "failed",
        "softBounce": "failed",
        "blocked": "failed",
        "invalid": "failed",
        "error": "failed",
        "rejected": "failed",
        "request": "sent",
        "sent": "sent",
    }
    status = mapping.get(data.get("event"))
    # Delivery is not rolled back by late sent/error notifications; clicks/opens never fabricate delivery.
    if (
        status
        and msg.status != "delivered"
        and not (msg.status == "failed" and status == "sent")
    ):
        msg.status = status
        r = db.scalar(select(m.Dispatch).where(m.Dispatch.message_id == msg.id))
        if r:
            r.status = status
            r.updated_at = o.stamp()
        db.commit()
    return {"ok": True, "matched": True}


# Patient preadmission and companion access. No sharing of the patient's account or rights management.
def patient_context(p, db):
    pat = _patient(p, db)
    _need_consent(db, pat)
    return pat


@router.get("/portal/overview")
def portal_overview(p: Principal = Patient, db: Session = Depends(get_db)):
    pat = patient_context(p, db)
    js = list(
        db.scalars(
            select(m.PatientJourney).where(
                m.PatientJourney.patient_id == pat.id,
                m.PatientJourney.establishment_id == p.establishment_id,
            )
        )
    )
    grants = (
        []
        if p.delegate_id
        else [
            o.serial(r, "id label revoked expires_at")
            for r in db.scalars(
                select(m.CompanionGrant).where(m.CompanionGrant.patient_id == pat.id)
            )
        ]
    )
    events = db.scalars(
        select(m.AdministrativeEvent).where(
            m.AdministrativeEvent.journey_id.in_([j.id for j in js]),
            m.AdministrativeEvent.kind.in_(["patient_message", "profile_requested"]),
        )
    ).all()
    return {
        "delegate": bool(p.delegate_id),
        "notifications_enabled": (
            db.get(m.PatientContactPreference, pat.id).enabled
            if db.get(m.PatientContactPreference, pat.id)
            else True
        ),
        "profile": {}
        if p.delegate_id
        else {
            "phone": pat.phone,
            "email": pat.email,
            "language": pat.language,
            "preferred_channel": pat.preferred_channel,
        },
        "delegations": grants,
        "journeys": [
            {
                "id": str(j.id),
                "reference": j.reference,
                "finance": {"quote": 0, "estimated_patient_share": 0, "balance": 0}
                if p.delegate_id
                else o.finances(db, j.id),
                "tasks": [
                    {
                        "id": str(t.id),
                        "status": t.status,
                        "title": t.title,
                        "reason": t.detail if t.status == "todo" else "",
                    }
                    for t in j.tasks
                    if t.kind in ("document", "questionnaire")
                ],
                "messages": [
                    {
                        "id": str(r.id),
                        "body": o.decrypt(r.encrypted_body),
                        "status": r.status,
                    }
                    for r in db.scalars(
                        select(m.Dispatch)
                        .where(m.Dispatch.journey_id == j.id)
                        .order_by(m.Dispatch.created_at.desc())
                    )
                ],
            }
            for j in js
        ],
    }


class ProfileIn(Input):
    phone: str = Field(default="", max_length=30)
    email: str = Field(default="", max_length=200)
    language: Literal["fr", "ar"] = "fr"
    preferred_channel: Literal["sms", "whatsapp", "email"] = "whatsapp"


@router.post("/portal/profile")
def profile_request(
    b: ProfileIn, p: Principal = Patient, db: Session = Depends(get_db)
):
    pat = patient_context(p, db)
    if p.delegate_id:
        raise HTTPException(403, "Action réservée au patient")
    if b.email and ("@" not in b.email or "\n" in b.email or "\r" in b.email):
        raise HTTPException(422, "E-mail invalide")
    if b.phone:
        from app.moroccan import normalize_ma_phone

        b.phone = normalize_ma_phone(b.phone) or ""
        if not b.phone:
            raise HTTPException(422, "Téléphone marocain invalide")
    j = db.scalar(
        select(m.PatientJourney).where(
            m.PatientJourney.patient_id == pat.id, m.PatientJourney.status == "active"
        )
    )
    if not j:
        raise HTTPException(409, "Aucun parcours actif")
    r = o.event(db, p, j.id, "profile_requested", b.model_dump())
    db.commit()
    return {"id": str(r.id), "status": "pending_review"}


@router.post("/events/{id}/confirm-profile")
def confirm_profile(id: uuid.UUID, p: Principal = Coord, db: Session = Depends(get_db)):
    e = scoped(db, m.AdministrativeEvent, id, p)
    if e.kind != "profile_requested":
        raise HTTPException(409, "Demande déjà traitée")
    j = lock_journey(db, p, e.journey_id)
    db.refresh(e)
    if e.kind != "profile_requested":
        raise HTTPException(409, "Demande déjà traitée")
    data = ProfileIn(**o.decrypt(e.encrypted_text))
    pat = db.get(m.Patient, j.patient_id)
    for k, v in data.model_dump().items():
        setattr(pat, k, v)
    e.kind = "profile_confirmed"
    o.event(db, p, j.id, "profile_validated", {"request": str(e.id)})
    db.commit()
    return {"ok": True}


class PatientMessageIn(Input):
    journey_id: uuid.UUID
    text: str = Field(min_length=1, max_length=2000)


@router.post("/portal/messages")
def patient_message(
    b: PatientMessageIn, p: Principal = Patient, db: Session = Depends(get_db)
):
    pat = patient_context(p, db)
    j = scoped(db, m.PatientJourney, b.journey_id, p)
    if j.patient_id != pat.id:
        raise HTTPException(404, "Introuvable")
    r = m.Dispatch(
        establishment_id=p.establishment_id,
        journey_id=j.id,
        request_key="inbound:" + str(uuid.uuid4()),
        actor=p.sub,
        encrypted_body=o.encrypt(b.text),
        status="inbound",
    )
    db.add(r)
    o.event(
        db, p, j.id, "patient_message", "Réponse administrative reçue dans le portail"
    )
    db.commit()
    return {"id": str(r.id)}


class HelpIn(Input):
    text: str = Field(min_length=1, max_length=2000)


@router.post("/portal/support")
def portal_support(b: HelpIn, p: Principal = Patient, db: Session = Depends(get_db)):
    pat = patient_context(p, db)
    from app.storage import _fernet

    db.add(
        m.SupportRequest(
            establishment_id=p.establishment_id,
            patient_id=pat.id,
            encrypted_message=_fernet().encrypt(b.text.encode()),
        )
    )
    db.commit()
    return {"ok": True}


@router.post("/support/{id}/resolve")
def support_resolve(id: uuid.UUID, p: Principal = Coord, db: Session = Depends(get_db)):
    r = scoped(db, m.SupportRequest, id, p)
    r.status = "resolved"
    svc.audit(db, p, "support.resolve", "support_request", id)
    db.commit()
    return {"ok": True}


class GrantIn(Input):
    label: str = Field(min_length=1, max_length=100)


@router.post("/portal/delegations")
def grant_create(b: GrantIn, p: Principal = Patient, db: Session = Depends(get_db)):
    pat = patient_context(p, db)
    if p.delegate_id:
        raise HTTPException(403, "Action réservée au patient")
    token = secrets.token_urlsafe(32)
    code = "".join(secrets.choice("0123456789") for _ in range(6))
    r = m.CompanionGrant(
        establishment_id=p.establishment_id,
        patient_id=pat.id,
        label=b.label,
        token_hash=hashlib.sha256(token.encode()).hexdigest(),
        code_hash=hashlib.sha256((token + ":" + code).encode()).hexdigest(),
        expires_at=o.stamp() + dt.timedelta(hours=72),
    )
    db.add(r)
    svc.audit(db, p, "companion.create", "patient", pat.id)
    db.commit()
    return {
        "id": str(r.id),
        "link": get_settings().public_web_url.rstrip("/") + "/accompagner/" + token,
        "code": code,
        "expires_at": r.expires_at.isoformat(),
        "notice": "Transmettez le lien et le code séparément. Accès limité aux documents et échanges administratifs pendant 72 h.",
    }


@router.delete("/portal/delegations/{id}")
def grant_revoke(id: uuid.UUID, p: Principal = Patient, db: Session = Depends(get_db)):
    pat = patient_context(p, db)
    r = scoped(db, m.CompanionGrant, id, p)
    if p.delegate_id or r.patient_id != pat.id:
        raise HTTPException(404, "Introuvable")
    r.revoked = True
    svc.audit(db, p, "companion.revoke", "patient", pat.id)
    db.commit()
    return {"ok": True}


class CompanionIn(Input):
    token: str = Field(min_length=10, max_length=100)
    code: str = Field(pattern=r"^\d{6}$")


@router.post("/companion/session")
def companion_session(b: CompanionIn, db: Session = Depends(get_db)):
    r = db.scalar(
        select(m.CompanionGrant)
        .where(
            m.CompanionGrant.token_hash == hashlib.sha256(b.token.encode()).hexdigest()
        )
        .with_for_update()
    )
    if (
        not r
        or r.revoked
        or r.attempts >= 5
        or r.expires_at.replace(tzinfo=dt.timezone.utc) < o.stamp()
    ):
        raise HTTPException(401, "Lien ou code invalide")
    if not hmac.compare_digest(
        r.code_hash, hashlib.sha256((b.token + ":" + b.code).encode()).hexdigest()
    ):
        r.attempts += 1
        db.commit()
        raise HTTPException(401, "Lien ou code invalide")
    pat = db.get(m.Patient, r.patient_id)
    if not pat or pat.anonymized_at:
        raise HTTPException(401, "Lien ou code invalide")
    s = get_settings()
    expires = min(
        r.expires_at.replace(tzinfo=dt.timezone.utc),
        o.stamp() + dt.timedelta(hours=s.patient_session_hours),
    )
    seconds = int((expires - o.stamp()).total_seconds())
    token = jwt.encode(
        {
            "sub": "companion:" + str(r.id),
            "establishment_id": str(r.establishment_id),
            "patient_id": str(r.patient_id),
            "delegate_id": str(r.id),
            "iss": PORTAL_ISSUER,
            "aud": s.oidc_audience,
            "iat": o.stamp(),
            "exp": expires,
        },
        s.patient_session_secret,
        algorithm="HS256",
    )
    svc.audit(
        db,
        Principal("companion:" + str(r.id), r.establishment_id, frozenset({"patient"})),
        "companion.login",
        "patient",
        pat.id,
    )
    db.commit()
    return {
        "access_token": token,
        "expires_in": seconds,
        "first_name": r.label,
        "language": pat.language,
        "delegated": True,
    }


@router.get("/setup")
def setup_read(p: Principal = Staff, db: Session = Depends(get_db)):
    r = db.get(m.FacilityPreferences, p.establishment_id)
    s = get_settings()
    templates = rows(db, m.JourneyTemplate, p)
    return {
        "preferences": o.serial(
            r, "support_phone support_email contact_start_hour contact_end_hour"
        )
        if r
        else {
            "support_phone": "",
            "support_email": "",
            "contact_start_hour": 8,
            "contact_end_hour": 20,
        },
        "checklist": [
            {
                "label": "Un parcours publié",
                "done": any(t.status == "published" for t in templates),
            },
            {
                "label": "Équipe rattachée",
                "done": any(x.active for x in rows(db, m.TeamMember, p)),
            },
            {
                "label": "Contact patient renseigné",
                "done": bool(r and (r.support_email or r.support_phone)),
            },
            {
                "label": "Observations avant pilote saisies",
                "done": any(
                    x.cohort == "baseline" for x in rows(db, m.TimeObservation, p)
                ),
            },
            {
                "label": "Transport externe configuré",
                "done": s.messaging_provider == "brevo"
                and bool(s.brevo_api_key and s.brevo_sender_email),
            },
        ],
        "notice": "Cette checklist ne constitue pas une autorisation de traiter des données réelles. La démo reste fictive.",
    }


class PreferencesIn(Input):
    support_phone: str = Field(default="", max_length=30)
    support_email: str = Field(default="", max_length=200)
    contact_start_hour: int = Field(default=8, ge=0, le=23)
    contact_end_hour: int = Field(default=20, ge=1, le=24)


@router.put("/setup")
def setup_write(b: PreferencesIn, p: Principal = Admin, db: Session = Depends(get_db)):
    from app.moroccan import normalize_ma_phone

    if b.support_email and (
        "@" not in b.support_email or "\n" in b.support_email or "\r" in b.support_email
    ):
        raise HTTPException(422, "E-mail invalide")
    if b.support_phone:
        b.support_phone = normalize_ma_phone(b.support_phone) or ""
        if not b.support_phone:
            raise HTTPException(422, "Téléphone marocain invalide")
    if b.contact_start_hour >= b.contact_end_hour:
        raise HTTPException(
            422, "La fin doit être après le début, sur une même journée"
        )
    r = db.get(m.FacilityPreferences, p.establishment_id)
    if not r:
        r = m.FacilityPreferences(establishment_id=p.establishment_id)
        db.add(r)
    for k, v in b.model_dump().items():
        setattr(r, k, v)
    svc.audit(db, p, "setup.update", "establishment", p.establishment_id)
    db.commit()
    return {"ok": True}


@router.post("/team/register-self")
def register_self(p: Principal = Coord, db: Session = Depends(get_db)):
    r = db.scalar(
        select(m.TeamMember).where(
            m.TeamMember.establishment_id == p.establishment_id,
            m.TeamMember.subject == p.sub,
        )
    )
    if not r:
        r = m.TeamMember(
            establishment_id=p.establishment_id,
            subject=p.sub,
            display_name=p.name or p.email or "Mon compte",
            role="admin" if "admin" in p.roles else "coordinator",
        )
        db.add(r)
    db.commit()
    return member_json(r)


@router.post("/messages/{id}/read")
def read_reply(id: uuid.UUID, p: Principal = Coord, db: Session = Depends(get_db)):
    r = scoped(db, m.Dispatch, id, p)
    if r.status != "inbound":
        raise HTTPException(409, "Réponse déjà traitée ou message sortant")
    r.status = "inbound_read"
    r.updated_at = o.stamp()
    o.event(db, p, r.journey_id, "reply_read", {"message": str(id)})
    db.commit()
    return {"ok": True}


class NotificationIn(Input):
    enabled: bool


@router.post("/portal/notifications")
def notifications(
    b: NotificationIn, p: Principal = Patient, db: Session = Depends(get_db)
):
    pat = patient_context(p, db)
    if p.delegate_id:
        raise HTTPException(403, "Action réservée au patient")
    r = db.get(m.PatientContactPreference, pat.id)
    if not r:
        r = m.PatientContactPreference(
            patient_id=pat.id, establishment_id=p.establishment_id
        )
        db.add(r)
    r.enabled = b.enabled
    svc.audit(db, p, "notifications.preference", "patient", pat.id, enabled=b.enabled)
    db.commit()
    return {"enabled": r.enabled}
