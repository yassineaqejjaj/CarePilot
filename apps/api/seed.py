"""Seed de DÉMO : clinique, patients et parcours FICTIFS (Casablanca), alignés sur la planche de design.

Les dates sont relatives à aujourd'hui (fuseau Africa/Casablanca) pour que le cockpit reste cohérent.
Idempotent : ne fait rien si l'établissement existe déjà (RESET=1 pour repartir de zéro).
Les numéros de téléphone sont des fixes fictifs (05 00 00 00 0X) : aucun SMS/WhatsApp réel ne peut aboutir.
"""
import base64
import datetime as dt
import os
import uuid

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app import models as m
from app import services as svc
from app import storage
from app.core import get_settings, init_engine, today
from app.templates_msg import render

EST = uuid.UUID("00000000-0000-0000-0000-000000000001")
PAT_DEMO = uuid.UUID("00000000-0000-0000-0000-0000000000a1")  # compte patient de démo (Keycloak)
SALMA, YOUSSEF, IMANE = "Salma El Idrissi", "Youssef Bennani", "Imane Chraibi"
PNG_1PX = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")

DETAILS = {
    "Création du parcours": ("CarePilot (automatique)", "Parcours créé depuis la programmation opératoire · demande de documents envoyée"),
    "Revue des documents administratifs": (None, "Contrôle des documents reçus par la coordinatrice"),
    "Rappel": ("CarePilot · validé par la coordinatrice", "Rappel envoyé par WhatsApp"),
    "Revue des réponses": (None, "Vérification des réponses et pièces du patient"),
    "Relance coordinatrice": (None, "Appel si le dossier reste incomplet"),
    "Informations pratiques": ("CarePilot · validation humaine", "Heure d'arrivée, accès, consignes administratives d'admission"),
    "Mise à jour du statut d'intervention": ("Service ambulatoire", "Admission, sortie et statut administratif du séjour"),
    "Suivi administratif": (YOUSSEF, "Questionnaire de satisfaction, documents de sortie, facturation"),
    "Parcours terminé": ("—", "Clôture et archivage du parcours"),
}
ALL = ["cin", "attestation_amo", "questionnaire_admission", "mutuelle", "consentement_admin"]

# (prénom, nom, naissance, intervention, chirurgien, jours avant intervention, responsable, documents, relances, patient_id, langue, canal)
PATIENTS = [
    ("Khadija", "Alaoui", dt.date(1986, 3, 14), "Arthroscopie du genou droit", "Dr K. Benkirane", 8, SALMA,
     {"cin": "done", "attestation_amo": "done", "questionnaire_admission": "done"}, 1, PAT_DEMO, "fr", "whatsapp"),
    ("Mohamed", "Tazi", dt.date(1958, 7, 2), "Chirurgie de la cataracte", "Dr A. Mansouri", 4, YOUSSEF,
     {"cin": "done", "attestation_amo": "done", "mutuelle": "done"}, 2, None, "ar", "whatsapp"),
    ("Nadia", "Berrada", dt.date(1974, 11, 23), "Coloscopie", "Dr L. Sebti", 6, SALMA,
     {"cin": "done", "attestation_amo": "done", "questionnaire_admission": "done", "consentement_admin": "done"}, 0, None, "fr", "sms"),
    ("Omar", "Lahlou", dt.date(1969, 1, 9), "Libération du canal carpien", "Dr K. Benkirane", 7, IMANE, {k: "done" for k in ALL}, 0, None, "fr", "whatsapp"),
    ("Hassan", "Fassi", dt.date(1981, 5, 30), "Arthroscopie de l'épaule", "Dr K. Benkirane", -2, YOUSSEF, "completed", 0, None, "fr", "whatsapp"),
    ("Zineb", "Cherkaoui", dt.date(1990, 9, 18), "Hernie inguinale", "Dr A. Mansouri", 12, IMANE,
     {"cin": "done", "attestation_amo": "submitted"}, 0, None, "fr", "whatsapp"),
    ("Meryem", "Zouiten", dt.date(1995, 2, 12), "Chirurgie du pied", "Dr L. Sebti", 15, SALMA,
     {"cin": "done", "attestation_amo": "done", "mutuelle": "done"}, 0, None, "fr", "email"),
    ("Karim", "Benali", dt.date(1977, 12, 3), "Ablation de lipome", "Dr A. Mansouri", 3, YOUSSEF, {"cin": "done"}, 3, None, "ar", "whatsapp"),
    ("Anas", "Kettani", dt.date(1988, 6, 21), "Cure de varices", "Dr L. Sebti", 10, IMANE, {k: "done" for k in ALL}, 0, None, "fr", "whatsapp"),
    ("Salma", "Ouazzani", dt.date(1992, 4, 8), "Chirurgie de l'hallux valgus", "Dr L. Sebti", 19, SALMA, {"cin": "done", "attestation_amo": "done"}, 0, None, "fr", "whatsapp"),
    ("Driss", "Amrani", dt.date(1964, 8, 27), "Réparation du tendon d'Achille", "Dr K. Benkirane", 23, YOUSSEF, {}, 0, None, "ar", "sms"),
    ("Hajar", "Skalli", dt.date(1983, 10, 15), "Arthroscopie de la hanche", "Dr K. Benkirane", 26, IMANE, {}, 0, None, "fr", "whatsapp"),
]


def seed(db: Session) -> None:
    if db.get(m.Establishment, EST):
        if not os.environ.get("RESET"):
            print("déjà seedé")
            return
        for t in (m.MessageLog, m.Document, m.StoredFile, m.Invitation, m.DataRequest, m.Consent, m.AIProposal, m.AIUsage, m.AuditLog,
                  m.KnowledgeChunk, m.KnowledgeDocument, m.Task, m.PatientJourney, m.Patient, m.TemplateStep, m.JourneyTemplate, m.Establishment):
            db.execute(delete(t))
        db.flush()
    t0 = today()
    db.add(m.Establishment(id=EST, name="Clinique Atlas · Casablanca", city="Casablanca", dpo_contact="dpo@clinique-atlas.example",
                           cndp_ref="", cndp_transfer_ref="", retention_days=365))
    db.flush()
    tpl = svc.seed_ambulatory_template(db, EST)
    db.flush()
    now = dt.datetime.now(dt.timezone.utc)
    clinic = "Clinique Atlas"
    for i, (fn, ln, born, proc, surgeon, days, owner, docs, reminders, pid, lang, chan) in enumerate(PATIENTS):
        kw = {"id": pid} if pid else {}
        pat = m.Patient(establishment_id=EST, ref=f"PT-d{i + 1:03d}-demo", first_name=fn, last_name=ln, birth_date=born,
                        phone=f"+2125000000{i:02d}", language=lang, preferred_channel=chan, **kw)
        db.add(pat)
        db.flush()
        j = svc.instantiate_journey(db, tpl, pat, t0 + dt.timedelta(days=days))
        j.reference, j.procedure, j.surgeon, j.owner, j.admission_time = f"PAR-2026-{4700 + i * 37:05d}", proc, surgeon, owner, "08:00"
        db.flush()
        done_all = docs == "completed"
        if done_all:
            j.status, j.completed_at = "completed", now - dt.timedelta(days=1)
        for t in j.tasks:
            who, detail = DETAILS.get(t.title, (None, ""))
            t.owner, t.detail = (who.replace("la coordinatrice", owner) if who else None), detail
            if t.required_document:
                state = "done" if done_all else docs.get(t.required_document, "todo")
                t.status = state
                if state == "done":
                    svc.complete_task(t)
                if state == "submitted":  # une vraie pièce chiffrée, consultable par le coordinateur
                    storage.save_upload(db, EST, j.id, t.id, "attestation-amo.png", PNG_1PX, "patient")
            elif done_all or t.due_date < t0:
                svc.complete_task(t, automated=t.title in ("Création du parcours", "Rappel"))
            if t.title == "Rappel":
                t.reminders = reminders
        if done_all:
            j.status, j.completed_at = "completed", now - dt.timedelta(days=1)
        db.add(m.AuditLog(establishment_id=EST, actor="demo", action="journey.create", entity="patient_journey", entity_id=str(j.id),
                          detail={"journey_id": str(j.id), "actor_label": "CarePilot"}, at=now - dt.timedelta(days=13 + i)))
        if reminders:
            db.add(m.MessageLog(establishment_id=EST, journey_id=j.id, patient_id=pat.id, kind="reminder", channel=chan,
                                to_masked="+2125•••••" + f"{i:02d}", subject="Document à nous transmettre", status="simulated",
                                created_at=now - dt.timedelta(days=2, hours=i)))
        if pid:  # Khadija : relance préparée (modèle approuvé), en attente de validation humaine
            todo = next(t for t in j.tasks if t.required_document == "mutuelle")
            msg = render("missing_document", lang, first_name=fn, date=j.surgery_date.strftime("%d/%m/%Y"), document=todo.title.lower(), clinic=clinic)
            db.add(m.AIProposal(establishment_id=EST, journey_id=j.id, agent="automation", kind="message_draft", payload={
                **msg, "requires_validation": True, "channel": "auto", "model": "Modèle approuvé · document manquant",
                "task_id": str(todo.id), "language": lang, "demo": True}))
            db.add(m.AuditLog(establishment_id=EST, actor="demo", action="portal.submit", entity="task", entity_id="x",
                              detail={"journey_id": str(j.id), "title": "Questionnaire d'admission", "actor_label": f"{fn} {ln}"}, at=now - dt.timedelta(days=8)))
            db.add(m.DataRequest(establishment_id=EST, patient_id=pat.id, kind="rectification",
                                 message="Mon numéro de téléphone a changé, merci de le mettre à jour.", created_at=now - dt.timedelta(days=1)))
    # propositions de vérification (file de validation)
    for ref_idx, anomalies in ((7, ["Trois relances restées sans réponse : appel recommandé."]),
                               (1, ["Deux relances restées sans réponse.", "Échéance du questionnaire dépassée."])):
        pat = db.scalar(select(m.Patient).where(m.Patient.ref == f"PT-d{ref_idx + 1:03d}-demo"))
        j = db.scalar(select(m.PatientJourney).where(m.PatientJourney.patient_id == pat.id))
        db.add(m.AIProposal(establishment_id=EST, journey_id=j.id, agent="administrative", kind="verification", payload={
            "missing_documents": [t.required_document for t in j.tasks if t.required_document and t.status == "todo"],
            "anomalies": anomalies, "summary": f"Dossier incomplet à J-{(j.surgery_date - t0).days}.", "demo": True}))
    db.commit()
    print("seed ok")


if __name__ == "__main__":
    with Session(init_engine(get_settings().database_url)) as s:
        seed(s)
