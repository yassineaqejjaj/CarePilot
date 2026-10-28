"""Inspectable administrative assistance: explanations, copilot plans and approved-procedure chat."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
import unicodedata
import uuid
from sqlalchemy import select
from fastapi import HTTPException

from app import models as m, services as svc
from app.core import today
from app.templates_msg import render

DEMO_PROCEDURES = [
    ("documents", "Déposer une pièce administrative", {
        "fr": "Ouvrez votre espace patient, choisissez la pièce demandée et prenez une photo nette ou choisissez un fichier PDF, JPEG ou PNG. Votre équipe vérifie ensuite la pièce avant de la valider.",
        "darija": "دخل لفضاء المريض ديالك، اختار الورقة المطلوبة وصورها واضحة ولا اختار ملف PDF أو صورة. الفريق غادي يراجعها قبل ما يصادق عليها."}),
    ("insurance", "AMO, CNSS, CNOPS et prise en charge", {
        "fr": "Préparez votre attestation AMO (CNSS ou CNOPS) et, si elle est demandée dans votre dossier, la prise en charge de votre mutuelle ou assurance. Seule la clinique confirme les pièces nécessaires et les conditions de prise en charge.",
        "darija": "وجد شهادة AMO ديال CNSS ولا CNOPS، وإلا كانت مطلوبة زيد موافقة الموطويل ولا التأمين. الكلينيك هي اللي كتأكد ليك الوثائق وشروط التكفل."}),
    ("arrival", "Heure et informations d'admission", {
        "fr": "L'heure d'admission affichée dans votre parcours est votre référence. Pour confirmer l'accès, un changement d'horaire ou un document à apporter, contactez le service des admissions. L'assistant ne donne aucune consigne médicale.",
        "darija": "شوف وقت الدخول فالمسار ديالك. باش تأكد العنوان ولا تبديل الموعد ولا شي ورقة تجيبها، تواصل مع مصلحة القبول. المساعد ما كيعطيش نصائح طبية."}),
    ("privacy", "Données personnelles et droits", {
        "fr": "Dans Mes données, vous pouvez télécharger vos informations ou demander une rectification, une opposition ou un effacement. La clinique traite votre demande selon ses obligations de conservation.",
        "darija": "فخانة المعطيات ديالي تقدر تحمل المعلومات ديالك ولا تطلب تصحيحها أو تعترض على الاستعمال أو تطلب المسح. الكلينيك كتجاوب حسب الالتزامات ديال حفظ الملفات."}),
]


def ensure_demo_procedures(db, est):
    from app.core import get_settings
    if not get_settings().demo_mode:
        return
    existing = set(db.scalars(select(m.ProcedureCard.topic).where(m.ProcedureCard.establishment_id == est)).all())
    for topic, title, content in DEMO_PROCEDURES:
        if topic not in existing:
            db.add(m.ProcedureCard(establishment_id=est, topic=topic, title=title, content=content, status="approved", approved_by="demo-reference"))
    db.flush()


def fold(text):
    return "".join(c for c in unicodedata.normalize("NFKD", text.casefold()) if not unicodedata.combining(c))


def blockers(j, on=None):
    on = on or today()
    out = []
    for t in sorted(j.tasks, key=lambda x: x.due_date):
        if t.status == "done" or (t.status == "todo" and t.due_date > on):
            continue
        review = t.status == "submitted"
        out.append({"task_id": str(t.id), "title": t.title, "due_date": t.due_date.isoformat(),
                    "days_late": max(0, (on-t.due_date).days), "blocking": t.blocking,
                    "reason": "Pièce reçue : vérification de l'équipe attendue" if review else "Pièce manquante" if t.required_document else "Tâche administrative à traiter",
                    "owner": t.owner or j.owner, "next_action": "Vérifier puis valider ou redemander" if review else "Préparer une relance" if t.required_document else "Traiter la tâche",
                    "status": t.status})
    return {"items": out, "summary": f"{len(out)} point(s) à traiter, dont {sum(x['blocking'] for x in out)} bloquant(s)." if out else "Aucun blocage administratif identifié à ce jour.",
            "rule": "Échéances et statuts du dossier ; ce résultat ne prédit pas une annulation et ne décide pas de l'intervention."}


def fingerprint(j):
    raw = [(str(t.id), t.status, t.due_date.isoformat(), t.reminders) for t in sorted(j.tasks, key=lambda x: str(x.id))]
    return hashlib.sha256(json.dumps([j.status, j.surgery_date.isoformat(), raw]).encode()).hexdigest()


def make_plan(db, p, query):
    text = fold(query)
    if not any(w in text for w in ("relanc", "rappel", "remind")):
        return {"supported": False, "message": "Essayez : Prépare les relances des dossiers incomplets opérés cette semaine. Aucune action n'a été effectuée."}
    on = today()
    if "semaine" in text:
        start, end = on - dt.timedelta(days=on.weekday()), on + dt.timedelta(days=6-on.weekday())
    elif "demain" in text:
        start = end = on + dt.timedelta(days=1)
    else:
        start, end = on, on + dt.timedelta(days=7)
    pending = {r.journey_id for r in db.scalars(select(m.AIProposal).where(m.AIProposal.establishment_id == p.establishment_id,
                m.AIProposal.kind == "message_draft", m.AIProposal.status == "pending"))}
    candidates = []
    est = db.get(m.Establishment, p.establishment_id)
    for j in db.scalars(select(m.PatientJourney).where(m.PatientJourney.establishment_id == p.establishment_id,
                          m.PatientJourney.status == "active", m.PatientJourney.surgery_date >= start, m.PatientJourney.surgery_date <= end).order_by(m.PatientJourney.surgery_date)):
        if j.id in pending:
            continue
        pat = db.get(m.Patient, j.patient_id)
        if pat.anonymized_at:
            continue
        t = next((x for x in sorted(j.tasks, key=lambda x: x.due_date) if x.kind == "document" and x.status == "todo" and x.due_date <= on and x.reminders < svc.MAX_REMINDERS), None)
        if t is None:
            continue
        last = t.last_reminder_at
        if last and dt.datetime.now(dt.timezone.utc) - (last if last.tzinfo else last.replace(tzinfo=dt.timezone.utc)) < dt.timedelta(hours=48):
            continue
        msg = render("missing_document", pat.language, first_name=pat.first_name, date=j.surgery_date.strftime("%d/%m/%Y"), document=t.title, clinic=est.name)
        candidates.append({"journey_id": str(j.id), "task_id": str(t.id), "patient_name": f"{pat.first_name} {pat.last_name}",
                           "document": t.title, "surgery_date": j.surgery_date.isoformat(), "channel": pat.preferred_channel,
                           "snapshot": fingerprint(j), "message": msg})
        if len(candidates) >= 25:
            break
    plan = m.ActionPlan(establishment_id=p.establishment_id, actor=p.sub, intent="prepare_reminders",
                        payload={"start": start.isoformat(), "end": end.isoformat(), "items": candidates})
    db.add(plan)
    db.flush()
    return {"supported": True, "id": str(plan.id), "status": "preview", **plan.payload,
            "notice": "Après confirmation, ces brouillons seront placés en file de validation. Aucun message n'est envoyé par cette action."}


def apply_plan(db, p, plan):
    if plan.actor != p.sub and "admin" not in p.roles:
        raise HTTPException(403, "Ce plan appartient à un autre coordinateur")
    if plan.status == "applied":
        return plan.payload.get("result", {})
    stamp = plan.created_at if plan.created_at.tzinfo else plan.created_at.replace(tzinfo=dt.timezone.utc)
    if dt.datetime.now(dt.timezone.utc) - stamp > dt.timedelta(minutes=15):
        raise HTTPException(409, "Cet aperçu a expiré. Préparez un nouveau plan.")
    created, skipped = 0, 0
    for item in plan.payload["items"]:
        j = db.scalar(select(m.PatientJourney).where(m.PatientJourney.id == uuid.UUID(item["journey_id"]), m.PatientJourney.establishment_id == p.establishment_id).with_for_update())
        if j is None or fingerprint(j) != item["snapshot"]:
            skipped += 1
            continue
        pending = db.scalar(select(m.AIProposal.id).where(m.AIProposal.establishment_id == p.establishment_id,
                m.AIProposal.journey_id == j.id, m.AIProposal.kind == "message_draft", m.AIProposal.status == "pending").limit(1))
        if pending:
            skipped += 1
            continue
        db.add(m.AIProposal(establishment_id=p.establishment_id, journey_id=j.id, agent="copilot", kind="message_draft",
                           payload={**item["message"], "task_id": item["task_id"], "channel": "auto", "model": "Modèle approuvé · copilote", "requires_validation": True}))
        db.flush()
        created += 1
    result = {"created": created, "skipped": skipped, "sent": 0}
    plan.status, plan.payload = "applied", {**plan.payload, "result": result}
    svc.audit(db, p, "copilot.prepare", "action_plan", plan.id, **result)
    return result


MEDICAL = ("douleur", "saigne", "saign", "medicament", "traitement", "dose", "fievre", "anesthes", "diagnost", "manger", "jeuner", "دواء", "دوا", "وجع", "الم", "نزيف", "سخانة", "حمى", "بنج", "dwa", "wje3", "wja3")
TOPICS = {
    "insurance": ("amo", "cnss", "cnops", "mutuelle", "assurance", "prise en charge", "موطويل", "تأمين", "تامين", "تكفل"),
    "documents": ("document", "papier", "photo", "depos", "cin", "wra9", "wara9", "ورقة", "وراق", "وثيقة", "تصويرة", "نصور"),
    "arrival": ("heure", "arriv", "adresse", "horaire", "rdv", "وقت", "ندخل", "موعد", "عنوان", "sa3a"),
    "privacy": ("donnee", "supprim", "effac", "droit", "حذف", "مسح", "معطيات"),
}


def reply(db, est_id, question, language):
    txt = fold(question)
    dar = language == "darija"
    if any((w in txt if len(w) > 3 else re.search(r"(?<!\w)" + re.escape(w) + r"(?!\w)", txt)) for w in MEDICAL):
        return {"answer": "هاد السؤال طبي. تواصل مع الفريق الطبي ديالك، وإذا كانت الحالة مستعجلة اتصل بالمستعجلات المحلية." if dar else "Cette question relève de l'équipe soignante. Contactez votre équipe médicale ; en cas d'urgence, contactez les secours locaux.", "handoff": True, "sources": [], "engine": "medical-boundary"}
    ensure_demo_procedures(db, est_id)
    topics = [topic for topic, words in TOPICS.items() if any(w in txt for w in words)]
    cards = db.scalars(select(m.ProcedureCard).where(m.ProcedureCard.establishment_id == est_id,
                   m.ProcedureCard.status == "approved", m.ProcedureCard.topic.in_(topics)).order_by(m.ProcedureCard.version.desc())).all() if topics else []
    card = next((c for c in cards if c.content.get(language)), None)
    if not card:
        return {"answer": "ما عنديش جواب مؤكد فالإجراءات المصادق عليها. نقدر نحول السؤال لمصلحة القبول." if dar else "Je n'ai pas de réponse dans les procédures approuvées. Vous pouvez transmettre votre question au service des admissions.", "handoff": True, "sources": [], "engine": "approved-procedures-local"}
    return {"answer": card.content[language], "handoff": False,
            "sources": [{"id": str(card.id), "title": card.title, "version": card.version, "approved_by": card.approved_by}], "engine": "approved-procedures-local"}


def simulate(steps, start, scenario):
    """Pure simulation: no database write, no message sent, no production status modified."""
    out = []
    for s in sorted(steps, key=lambda x: x["offset_days"]):
        day = s["offset_days"]
        missing = scenario == "missing_document" and s.get("kind") == "document"
        out.append({"day": day, "date": (start + dt.timedelta(days=day)).isoformat(), "title": s["title"], "kind": s["kind"],
                    "event": "Pièce manquante → proposition de relance, validation humaine" if missing else "Pièce reçue → contrôle par l'équipe" if s["kind"] == "document" else "Message préparé → validation humaine" if s["kind"] == "message" else "Étape administrative planifiée",
                    "blocking": bool(s.get("blocking")), "state": "attention" if missing else "scheduled"})
    return {"scenario": scenario, "events": out, "writes": 0, "sent": 0}
