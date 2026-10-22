"""Seed de DÉMO : clinique, patients et parcours FICTIFS alignés sur la planche de design.

Les dates sont relatives à aujourd'hui pour que le cockpit reste cohérent quel que soit le jour.
Idempotent : ne fait rien si l'établissement existe déjà (RESET=1 pour repartir de zéro).
"""
import datetime as dt
import os
import uuid

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app import models as m
from app import services as svc
from app.core import get_settings, init_engine

EST = uuid.UUID("00000000-0000-0000-0000-000000000001")
PAT_SOPHIE = uuid.UUID("00000000-0000-0000-0000-0000000000a1")  # compte patient de démo
CLAIRE, JULIEN, INES = "Claire Dubois", "Julien Moreau", "Inès Haddad"

DETAILS = {
    "Création du parcours": ("CarePilot (automatique)", "Parcours créé depuis la programmation opératoire · demande de documents envoyée"),
    "Revue des documents administratifs": (None, "Contrôle des documents reçus par la coordinatrice"),
    "Rappel": ("CarePilot · validé par la coordinatrice", "Rappel envoyé par SMS et e-mail"),
    "Revue des réponses": (None, "Vérification des réponses et pièces du patient"),
    "Relance coordinatrice": (None, "Appel si le dossier reste incomplet"),
    "Informations pratiques": ("CarePilot · validation humaine", "Heure d'arrivée, accès, consignes administratives d'admission"),
    "Mise à jour du statut d'intervention": ("Service ambulatoire", "Admission, sortie et statut administratif du séjour"),
    "Suivi administratif": (JULIEN, "Questionnaire de satisfaction, documents de sortie, facturation"),
    "Parcours terminé": ("—", "Clôture et archivage du parcours"),
}

# (prénom, nom, naissance, intervention, chirurgien, jours avant intervention, responsable, docs {code: done|submitted}, relances, patient_id)
PATIENTS = [
    ("Sophie", "Martin", dt.date(1986, 3, 14), "Arthroscopie du genou droit", "Dr A. Perrin", 8, CLAIRE,
     {"piece_identite": "done", "carte_vitale": "done", "questionnaire_admission": "done", "consentement_admin": "todo"}, 1, PAT_SOPHIE),
    ("Marc", "Lefèvre", dt.date(1958, 7, 2), "Chirurgie de la cataracte", "Dr C. Sabatier", 4, JULIEN,
     {"piece_identite": "done", "carte_vitale": "done", "mutuelle": "done"}, 2, None),
    ("Nadia", "Benali", dt.date(1974, 11, 23), "Coloscopie", "Dr M. Rey", 6, CLAIRE,
     {"piece_identite": "done", "carte_vitale": "done", "questionnaire_admission": "done", "consentement_admin": "done"}, 0, None),
    ("Thomas", "Girard", dt.date(1969, 1, 9), "Libération du canal carpien", "Dr A. Perrin", 7, INES,
     {"piece_identite": "done", "carte_vitale": "done", "questionnaire_admission": "done", "mutuelle": "done", "consentement_admin": "done"}, 0, None),
    ("Paul", "Garnier", dt.date(1981, 5, 30), "Arthroscopie de l'épaule", "Dr A. Perrin", -2, JULIEN, "completed", 0, None),
    ("Hugo", "Lambert", dt.date(1990, 9, 18), "Hernie inguinale", "Dr C. Sabatier", 12, INES,
     {"piece_identite": "done", "carte_vitale": "submitted"}, 0, None),
    ("Léa", "Fontaine", dt.date(1995, 2, 12), "Chirurgie du pied", "Dr M. Rey", 15, CLAIRE,
     {"piece_identite": "done", "carte_vitale": "done", "mutuelle": "done"}, 0, None),
    ("Karim", "Aouad", dt.date(1977, 12, 3), "Ablation de lipome", "Dr C. Sabatier", 3, JULIEN,
     {"piece_identite": "done"}, 3, None),
    ("Julie", "Marchand", dt.date(1992, 4, 8), "Chirurgie de l'hallux valgus", "Dr M. Rey", 19, CLAIRE,
     {"piece_identite": "done", "carte_vitale": "done"}, 0, None),
    ("Antoine", "Vidal", dt.date(1964, 8, 27), "Réparation du tendon d'Achille", "Dr A. Perrin", 23, JULIEN, {}, 0, None),
    ("Camille", "Petit", dt.date(1983, 10, 15), "Arthroscopie de la hanche", "Dr A. Perrin", 26, INES, {}, 0, None),
    ("Emma", "Roux", dt.date(1988, 6, 21), "Cure de varices", "Dr M. Rey", 10, INES,
     {"piece_identite": "done", "carte_vitale": "done", "questionnaire_admission": "done", "mutuelle": "done", "consentement_admin": "done"}, 0, None),
]


def seed(db: Session) -> None:
    if db.get(m.Establishment, EST):
        if not os.environ.get("RESET"):
            print("déjà seedé")
            return
        for t in (m.AIProposal, m.AIUsage, m.AuditLog, m.KnowledgeChunk, m.KnowledgeDocument, m.Task, m.PatientJourney,
                  m.Patient, m.TemplateStep, m.JourneyTemplate, m.Establishment):
            db.execute(delete(t))
        db.flush()
    today = dt.date.today()
    db.add(m.Establishment(id=EST, name="Clinique du Parc Valmont · Lyon"))
    db.flush()
    tpl = svc.seed_ambulatory_template(db, EST)
    db.flush()
    now = dt.datetime.now(dt.timezone.utc)
    for i, (fn, ln, born, proc, surgeon, days, owner, docs, reminders, pid) in enumerate(PATIENTS):
        kw = {"id": pid} if pid else {}
        pat = m.Patient(establishment_id=EST, ref=f"P-demo{i + 1:04d}", first_name=fn, last_name=ln, birth_date=born, **kw)
        db.add(pat)
        db.flush()
        j = svc.instantiate_journey(db, tpl, pat, today + dt.timedelta(days=days))
        j.reference, j.procedure, j.surgeon, j.owner, j.admission_time = f"PAR-2026-{4700 + i * 37:05d}", proc, surgeon, owner, "7:30"
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
            elif done_all or t.due_date < today:
                svc.complete_task(t, automated=t.title in ("Création du parcours", "Rappel"))
            if t.title == "Rappel":
                t.reminders = reminders
        # activité de démonstration
        db.add(m.AuditLog(establishment_id=EST, actor="demo", action="journey.create", entity="patient_journey",
                          entity_id=str(j.id), detail={"journey_id": str(j.id), "actor_label": "CarePilot"},
                          at=now - dt.timedelta(days=13 + i)))
        if pid:  # Sophie : relance préparée par CarePilot, en attente de validation humaine
            mutuelle = next(t for t in j.tasks if t.required_document == "mutuelle")
            db.add(m.AIProposal(establishment_id=EST, journey_id=j.id, agent="communication", kind="message_draft", payload={
                "subject": "Votre attestation de mutuelle",
                "body": ("Bonjour Madame Martin,\n\nPour finaliser votre dossier d'admission du "
                         f"{j.surgery_date.strftime('%d/%m/%Y')}, il nous manque votre attestation de mutuelle. Vous pouvez la déposer "
                         "en photo depuis votre espace patient, rubrique « Mes documents », avant le lundi 26 octobre.\n\nMerci,\n"
                         "Le service des admissions — Clinique du Parc Valmont"),
                "requires_validation": True, "channel": "SMS + e-mail", "model": "Relance document manquant v3",
                "task_id": str(mutuelle.id), "demo": True}))
            db.add(m.AuditLog(establishment_id=EST, actor="demo", action="portal.submit", entity="task", entity_id="x",
                              detail={"journey_id": str(j.id), "title": "Désignation de la personne de confiance", "actor_label": "Sophie Martin"},
                              at=now - dt.timedelta(days=8)))
    # propositions de vérification (file de validation)
    for pat_ref, anomalies in (("P-demo0002", ["Deux relances restées sans réponse.", "Échéance du questionnaire dépassée de 8 jours."]),
                               ("P-demo0008", ["Trois relances sans réponse : appel recommandé."])):
        pat = db.scalar(select_patient(pat_ref))
        j = db.scalar(select_journey(pat.id))
        db.add(m.AIProposal(establishment_id=EST, journey_id=j.id, agent="administrative", kind="verification", payload={
            "missing_documents": [t.required_document for t in j.tasks if t.required_document and t.status == "todo"],
            "anomalies": anomalies, "summary": "Dossier incomplet à J-%d." % (j.surgery_date - today).days, "demo": True}))
    db.commit()
    print("seed ok")


def select_patient(ref):
    from sqlalchemy import select
    return select(m.Patient).where(m.Patient.ref == ref)


def select_journey(pid):
    from sqlalchemy import select
    return select(m.PatientJourney).where(m.PatientJourney.patient_id == pid)


if __name__ == "__main__":
    with Session(init_engine(get_settings().database_url)) as s:
        seed(s)
