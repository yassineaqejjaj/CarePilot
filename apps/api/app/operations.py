"""Administrative-only operations. No clinical ranking, eligibility or medical decisions."""

from __future__ import annotations
import datetime as dt
import json
import uuid
from sqlalchemy import select
from app import models as m, storage, services as svc
from app.core import today


def encrypt(value):
    return storage._fernet().encrypt(json.dumps(value, ensure_ascii=False).encode())


def decrypt(value):
    return json.loads(storage._fernet().decrypt(value))


def stamp():
    return dt.datetime.now(dt.timezone.utc)


def serial(row, fields):
    out = {k: getattr(row, k) for k in fields.split()}
    return {
        k: v.isoformat()
        if isinstance(v, (dt.date, dt.datetime))
        else str(v)
        if isinstance(v, uuid.UUID)
        else v
        for k, v in out.items()
    }


def event(db, p, jid, kind, text):
    row = m.AdministrativeEvent(
        establishment_id=p.establishment_id,
        journey_id=jid,
        actor=p.sub,
        kind=kind,
        encrypted_text=encrypt(text),
    )
    db.add(row)
    svc.audit(db, p, "operations." + kind, "patient_journey", jid, journey_id=str(jid))
    return row


def finances(db, jid):
    rows = list(
        db.scalars(
            select(m.FinanceEntry)
            .where(m.FinanceEntry.journey_id == jid)
            .order_by(m.FinanceEntry.created_at)
        )
    )
    voided = {r.reverses_id for r in rows if r.kind == "void"}
    live = [r for r in rows if r.id not in voided and r.kind != "void"]
    sums = {
        k: sum(r.amount_cents for r in live if r.kind == k)
        for k in ("quote", "coverage", "deposit", "refund")
    }
    net = sums["deposit"] - sums["refund"]
    return {
        "currency": "MAD",
        **sums,
        "net_deposits": net,
        "estimated_patient_share": max(0, sums["quote"] - sums["coverage"]),
        "balance": max(0, sums["quote"] - sums["coverage"] - net),
        "notice": "Estimation administrative confirmée par l’équipe. Aucun paiement ni garantie de couverture automatique.",
        "entries": [
            {
                **serial(r, "id kind amount_cents reference actor created_at"),
                "voided": r.id in voided,
                "reverses_id": str(r.reverses_id) if r.reverses_id else None,
            }
            for r in rows
        ],
    }


def worklist(db, p):
    journeys = list(
        db.scalars(
            select(m.PatientJourney).where(
                m.PatientJourney.establishment_id == p.establishment_id
            )
        )
    )
    cases = {
        r.journey_id: r
        for r in db.scalars(
            select(m.AdministrativeCase).where(
                m.AdministrativeCase.establishment_id == p.establishment_id
            )
        )
    }
    insurance = list(
        db.scalars(
            select(m.InsuranceCase).where(
                m.InsuranceCase.establishment_id == p.establishment_id
            )
        )
    )
    team = {
        r.subject: r
        for r in db.scalars(
            select(m.TeamMember).where(
                m.TeamMember.establishment_id == p.establishment_id
            )
        )
    }
    items = []
    for j in journeys:
        pat = db.get(m.Patient, j.patient_id)
        if not pat or pat.anonymized_at:
            continue
        c = cases.get(j.id)
        pending = [t for t in j.tasks if t.status != "done"]
        submitted = [t for t in pending if t.status == "submitted"]
        missing = [t for t in pending if t.blocking]
        ins = [
            r
            for r in insurance
            if r.journey_id == j.id
            and r.status in ("draft", "submitted", "more_info", "rejected")
        ]
        owner = team.get(c.assigned_subject) if c else None
        next_task = min(pending, key=lambda t: t.due_date) if pending else None
        help_count = len(
            list(
                db.scalars(
                    select(m.SupportRequest.id).where(
                        m.SupportRequest.patient_id == pat.id,
                        m.SupportRequest.status == "open",
                    )
                )
            )
        )
        profile_count = len(
            list(
                db.scalars(
                    select(m.AdministrativeEvent.id).where(
                        m.AdministrativeEvent.journey_id == j.id,
                        m.AdministrativeEvent.kind == "profile_requested",
                    )
                )
            )
        )
        unread = len(
            list(
                db.scalars(
                    select(m.Dispatch.id).where(
                        m.Dispatch.journey_id == j.id, m.Dispatch.status == "inbound"
                    )
                )
            )
        )
        items.append(
            {
                "id": str(j.id),
                "reference": j.reference,
                "patient": pat.first_name + " " + pat.last_name,
                "date": j.surgery_date.isoformat(),
                "owner": owner.display_name if owner else j.owner,
                "assigned_subject": c.assigned_subject if c else "",
                "department": c.department if c else "Admissions",
                "exception": c.exception if c else "",
                "phase": c.phase if c else "preparing",
                "revision": c.revision if c else 0,
                "owner_available": owner.available if owner else True,
                "backup_subject": owner.backup_subject if owner else "",
                "help_pending": help_count,
                "profile_pending": profile_count,
                "unread": unread,
                "pending": len(pending),
                "submitted": len(submitted),
                "missing": len(missing),
                "insurance_pending": len(ins),
                "administratively_complete": not missing,
                "next_action": "Répondre à une demande d’aide"
                if help_count
                else "Vérifier les coordonnées transmises"
                if profile_count
                else "Lire la réponse du patient"
                if unread
                else "Vérifier les documents reçus"
                if submitted
                else "Compléter la prise en charge"
                if ins
                else next_task.title
                if next_task
                else "Vérifier la clôture administrative",
                "due_date": next_task.due_date.isoformat() if next_task else None,
                "status": j.status,
            }
        )
    items.sort(
        key=lambda r: (
            r["status"] != "active",
            not (
                r["submitted"]
                or r["help_pending"]
                or r["profile_pending"]
                or r["unread"]
            ),
            r["due_date"] or "9999",
            r["reference"],
        )
    )
    return items


def staff_contributor(row):
    if row.actor.startswith(("patient:", "companion:", "integration:")):
        return False
    recorded_roles = row.detail.get("actor_roles")
    if recorded_roles is not None:
        return bool(
            set(recorded_roles) & {"admin", "coordinator", "designer", "viewer"}
        )
    # Historical events have no role metadata. Count only actions whose endpoints are staff-only.
    return row.action.startswith(
        (
            "journey.",
            "task.",
            "template.",
            "team.",
            "setup.",
            "ai.",
            "procedure.",
            "demo.",
        )
    ) or row.action in {
        "document.analyze",
        "document.download",
        "support.resolve",
        "operations.handoff",
        "operations.insurance",
        "operations.finance",
        "operations.message",
        "operations.note",
        "operations.reschedule",
        "operations.reply_read",
        "operations.profile_validated",
    }


def measures(db, est):
    journeys = list(
        db.scalars(
            select(m.PatientJourney).where(m.PatientJourney.establishment_id == est)
        )
    )
    active = [j for j in journeys if j.status == "active"]
    ready = sum(
        not any(t.blocking and t.status != "done" for t in j.tasks) for j in active
    )
    observations = list(
        db.scalars(
            select(m.TimeObservation).where(m.TimeObservation.establishment_id == est)
        )
    )
    groups = []
    for activity in sorted({r.activity for r in observations}):
        base = [
            r.seconds
            for r in observations
            if r.activity == activity and r.cohort == "baseline"
        ]
        pilot = [
            r.seconds
            for r in observations
            if r.activity == activity and r.cohort == "pilot"
        ]
        b = sum(base) / len(base) if base else None
        v = sum(pilot) / len(pilot) if pilot else None
        groups.append(
            {
                "activity": activity,
                "baseline_n": len(base),
                "pilot_n": len(pilot),
                "baseline_seconds": b,
                "pilot_seconds": v,
                "observed_difference_seconds": b - v
                if b is not None and v is not None
                else None,
            }
        )
    messages = list(
        db.scalars(select(m.MessageLog).where(m.MessageLog.establishment_id == est))
    )
    tasks = [t for j in journeys for t in j.tasks]
    valid = [t for t in tasks if t.completed_at]
    ins = list(
        db.scalars(
            select(m.InsuranceCase).where(m.InsuranceCase.establishment_id == est)
        )
    )
    resolved = [r for r in ins if r.status in ("approved", "rejected")]
    durations = [
        max(0, (r.updated_at - r.created_at).total_seconds() / 3600) for r in resolved
    ]
    return {
        "active": len(active),
        "ready": ready,
        "ready_pct": round(100 * ready / len(active), 1) if active else 0,
        "reminders": sum(t.reminders for t in tasks),
        "messages": {
            s: sum(r.status == s for r in messages)
            for s in ("simulated", "sent", "delivered", "failed")
        },
        "insurance_response_hours": sum(durations) / len(durations)
        if durations
        else None,
        "insurance_sample": len(durations),
        "observations": groups,
        "definition": "Observations manuelles baseline/pilote comparées par activité. Écart de moyennes observé, sans attribution causale ni gain extrapolé.",
        "adoption": len(
            {
                r.actor
                for r in db.scalars(
                    select(m.AuditLog).where(
                        m.AuditLog.establishment_id == est,
                        m.AuditLog.at >= stamp() - dt.timedelta(days=7),
                    )
                )
                if staff_contributor(r)
            }
        ),
    }
