"""Vues de lecture pour le cockpit, la liste des parcours et le détail d'un parcours."""
from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models as m
from app.core import today as _today

PRIORITY_LABEL = {"urgent": "Urgente", "high": "Haute", "medium": "Moyenne", "ready": "Prêt à valider"}


def doc_tasks(j: m.PatientJourney) -> list[m.Task]:
    return [t for t in j.tasks if t.required_document]


def progress(j: m.PatientJourney) -> dict:
    docs = doc_tasks(j)
    base = docs or j.tasks
    done = sum(t.status == "done" for t in base)
    return {"done": done, "total": len(base), "pct": round(100 * done / len(base)) if base else 100,
            "missing": sum(t.status == "todo" for t in base)}


def journey_state(j: m.PatientJourney, today: dt.date, pending_proposal: bool) -> str:
    """completed | late | action | waiting_patient | on_track"""
    if j.status == "completed" or all(t.status == "done" for t in j.tasks):
        return "completed"
    if any(t.blocking and t.status == "todo" and (today - t.due_date).days >= 3 for t in j.tasks):
        return "late"  # pièce bloquante en retard d'au moins 3 jours
    if pending_proposal or any(t.status == "submitted" for t in j.tasks):
        return "action"
    if any(t.kind == "document" and t.status == "todo" and t.due_date <= today for t in j.tasks):
        return "waiting_patient"
    return "on_track"


def priority(j: m.PatientJourney, today: dt.date, state: str) -> str:
    days = (j.surgery_date - today).days
    prog = progress(j)
    if prog["missing"] == 0 and prog["total"] and state != "completed":
        return "ready"
    if state == "late" and days <= 5:
        return "urgent"
    if state in ("late", "action", "waiting_patient") and days <= 10:
        return "high"
    return "medium"


def _pending(db: Session, est: uuid.UUID) -> dict[uuid.UUID, m.AIProposal]:
    rows = db.scalars(select(m.AIProposal).where(m.AIProposal.establishment_id == est,
                                                  m.AIProposal.status == "pending",
                                                  m.AIProposal.journey_id.is_not(None))).all()
    out: dict[uuid.UUID, m.AIProposal] = {}
    for r in rows:
        out.setdefault(r.journey_id, r)
    return out


def _next_doc(j: m.PatientJourney) -> str | None:
    for t in sorted(j.tasks, key=lambda t: t.due_date):
        if t.status != "done" and t.kind in ("document", "questionnaire"):
            return t.title
    return None


def _all(db: Session, est: uuid.UUID) -> list[m.PatientJourney]:
    return list(db.scalars(select(m.PatientJourney).where(m.PatientJourney.establishment_id == est)))


def _aware(d: dt.datetime) -> dt.datetime:
    return d if d.tzinfo else d.replace(tzinfo=dt.timezone.utc)


def _name(db: Session, journey_id) -> str:
    j = db.get(m.PatientJourney, journey_id) if journey_id else None
    pat = db.get(m.Patient, j.patient_id) if j else None
    return f"{pat.first_name} {pat.last_name}" if pat else ""


def cockpit(db: Session, est: uuid.UUID, today: dt.date | None = None) -> dict:
    today = today or _today()
    pend = _pending(db, est)
    journeys = _all(db, est)
    rows = []
    for j in journeys:
        st = journey_state(j, today, j.id in pend)
        rows.append((j, st))
    active = [(j, st) for j, st in rows if st != "completed"]
    open_tasks = [t for j, _ in active for t in j.tasks if t.status != "done"]
    overdue = [t for t in open_tasks if t.due_date <= today]
    week_ago = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=7)
    finished = [j for j, st in rows if st == "completed" and (j.completed_at is None or _aware(j.completed_at) >= week_ago)]
    soon = sorted((t for t in open_tasks if today <= t.due_date <= today + dt.timedelta(days=3)), key=lambda t: t.due_date)
    on_track = sum(st == "on_track" for _, st in active)
    queue = []
    order = {"urgent": 0, "high": 1, "medium": 2, "ready": 3}
    for j, st in active:
        pr = priority(j, today, st)
        pat = db.get(m.Patient, j.patient_id)
        prop = pend.get(j.id)
        queue.append({
            "journey_id": str(j.id), "priority": pr, "priority_label": PRIORITY_LABEL[pr],
            "days_to_surgery": (j.surgery_date - today).days, "patient_name": f"{pat.first_name} {pat.last_name}",
            "patient_ref": pat.ref, "reference": j.reference, "procedure": j.procedure,
            "surgery_date": j.surgery_date.isoformat(), "progress": progress(j)["pct"], "next_doc": _next_doc(j),
            "owner": j.owner, "state": st,
            "note": ("Relance préparée par M3aya Santé" if prop and prop.kind == "message_draft" else
                     "Tous les documents sont reçus" if pr == "ready" else
                     (f"{max(t.reminders for t in j.tasks)} relances sans réponse" if any(t.reminders for t in j.tasks) else None)),
            "proposal_id": str(prop.id) if prop else None,
            "proposal_kind": prop.kind if prop else None})
    queue.sort(key=lambda r: (order[r["priority"]], r["days_to_surgery"]))
    pending_all = db.scalars(select(m.AIProposal).where(m.AIProposal.establishment_id == est,
                                                         m.AIProposal.status == "pending")
                             .order_by(m.AIProposal.created_at)).all()
    first = next((p for p in pending_all if p.kind == "message_draft"), None) or (pending_all[0] if pending_all else None)
    return {
        "date": today.isoformat(),
        "kpis": {"active": len(active), "on_track": on_track,
                 "on_track_pct": round(100 * on_track / len(active)) if active else 0,
                 "incomplete": sum(st in ("late", "waiting_patient") for _, st in active),
                 "tasks_to_treat": len(overdue),
                 "urgent": sum(t.blocking and t.due_date < today for t in overdue),
                 "deadlines_72h": len(soon), "next_deadline": soon[0].due_date.isoformat() if soon else None,
                 "finished_week": len(finished)},
        "queue": queue,
        "validation_pending": len(pending_all),
        "assistant": {
            "proposal": ({"id": str(first.id), "kind": first.kind, "journey_id": str(first.journey_id) if first.journey_id else None,
                          "payload": first.payload,
                          "patient_name": _name(db, first.journey_id)} if first else None),
            "to_chase": sum(st in ("late", "waiting_patient") for _, st in active),
            "no_response": sum(1 for j, st in active if any(t.kind == "document" and t.status == "todo" and
                                                             t.due_date < today - dt.timedelta(days=3) for t in j.tasks)),
            "ready": sum(1 for r in queue if r["priority"] == "ready"),
        },
    }


STATE_LABEL = {"completed": "Terminé", "late": "En retard", "action": "Action requise",
               "waiting_patient": "En attente patient", "on_track": "En bonne voie"}


def journey_list(db: Session, est: uuid.UUID, today: dt.date | None = None) -> dict:
    today = today or _today()
    pend = _pending(db, est)
    items, counts = [], {k: 0 for k in STATE_LABEL}
    for j in _all(db, est):
        st = journey_state(j, today, j.id in pend)
        counts[st] += 1
        pat = db.get(m.Patient, j.patient_id)
        nxt = next((t for t in sorted(j.tasks, key=lambda t: t.due_date) if t.status != "done"), None)
        items.append({"journey_id": str(j.id), "patient_name": f"{pat.first_name} {pat.last_name}", "reference": j.reference,
                      "procedure": j.procedure, "surgery_date": j.surgery_date.isoformat(),
                      "days_to_surgery": (j.surgery_date - today).days, "stage": nxt.title if nxt else "Parcours terminé",
                      "progress": progress(j)["pct"], "state": st, "state_label": STATE_LABEL[st], "owner": j.owner})
    items.sort(key=lambda r: r["surgery_date"])
    return {"total": len(items), "counts": counts, "items": items}


def _step_label(delta: int) -> str:
    return "J0" if delta == 0 else f"J{delta}" if delta < 0 else f"J+{delta}"


ACTIVITY = {
    "task.complete": ("Action équipe", "Tâche validée : {title}"),
    "portal.submit": ("Patient", "Document déposé : {title}"),
    "journey.create": ("Automatique", "Parcours créé depuis la programmation opératoire."),
    "ai.approved": ("Action équipe", "Proposition M3aya Santé validée ({kind})."),
    "ai.rejected": ("Action équipe", "Proposition M3aya Santé rejetée ({kind})."),
}


def journey_detail(db: Session, j: m.PatientJourney, today: dt.date | None = None) -> dict:
    today = today or _today()
    pat = db.get(m.Patient, j.patient_id)
    pend = _pending(db, j.establishment_id)
    prop = pend.get(j.id)
    st = journey_state(j, today, prop is not None)
    tasks = sorted(j.tasks, key=lambda t: (t.due_date, t.title))
    current = next((t for t in tasks if t.status != "done"), None)
    timeline = []
    for t in tasks:
        delta = (t.due_date - j.surgery_date).days
        if t.status == "done":
            s = "done"
        elif current is not None and t.id == current.id and t.due_date <= today + dt.timedelta(days=3):
            s = "action"
        else:
            s = "upcoming"
        timeline.append({"id": str(t.id), "label": _step_label(delta), "title": t.title, "status": s,
                         "due_date": t.due_date.isoformat(), "owner": t.owner or j.owner or "M3aya Santé (automatique)",
                         "detail": t.detail, "kind": t.kind})
    files = {}
    for dcm in db.scalars(select(m.Document).where(m.Document.journey_id == j.id).order_by(m.Document.created_at)):
        files[dcm.task_id] = dcm  # le plus récent par pièce
    docs = [{"id": str(t.id), "title": t.title, "status": {"done": "Validé", "submitted": "En revue", "todo": "Manquant"}[t.status],
             "due_date": t.due_date.isoformat(), "file_id": str(files[t.id].id) if t.id in files else None,
             "file_name": files[t.id].filename if t.id in files else None} for t in tasks if t.required_document]
    logs = db.scalars(select(m.AuditLog).where(m.AuditLog.establishment_id == j.establishment_id)
                      .order_by(m.AuditLog.at.desc()).limit(300)).all()
    activity = []
    for a in logs:
        if a.detail.get("journey_id") != str(j.id) or a.action not in ACTIVITY:
            continue
        tag, text = ACTIVITY[a.action]
        activity.append({"at": a.at.isoformat(), "tag": tag, "text": text.format(**{"title": "", "kind": "", **a.detail}),
                         "actor": a.detail.get("actor_label", "")})
    prog = progress(j)
    from app.catalogue import metadata
    tpl = db.get(m.JourneyTemplate, j.template_id)
    return {"template_name": tpl.name, "catalogue": metadata(tpl.name),
        "journey_id": str(j.id), "state": st, "state_label": STATE_LABEL[st],
        "patient": {"name": f"{pat.first_name} {pat.last_name}", "ref": pat.ref, "birth_date": pat.birth_date.isoformat() if pat.birth_date else None},
        "reference": j.reference, "procedure": j.procedure, "surgeon": j.surgeon, "owner": j.owner,
        "surgery_date": j.surgery_date.isoformat(), "admission_time": j.admission_time,
        "days_to_surgery": (j.surgery_date - today).days, "template_version": j.template_version,
        "progress": prog, "timeline": timeline, "documents": docs, "activity": activity[:8],
        "next_action": {"proposal_id": str(prop.id), "kind": prop.kind, "agent": prop.agent, "payload": prop.payload} if prop else None,
    }
