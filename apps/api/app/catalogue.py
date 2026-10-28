"""Reference administrative pathways for Moroccan clinics. No clinical instructions or eligibility decisions.

Blueprints are suggestions to adapt and approve at each clinic, never universal medical protocols.
The demo bootstrap is additive and preserves existing published versions and patient journeys.
"""
from __future__ import annotations

import datetime as dt
import uuid
from sqlalchemy import select
from app import models as m
from app import services as svc


def step(day, title, kind="task", document=None, blocking=False):
    return dict(offset_days=day, title=title, kind=kind, required_document=document, blocking=blocking)


def doc(day,title,code,blocking=True):
    return step(day,title,"document",code,blocking)


CATALOGUE = [
    dict(key="consultation", name="Consultation spécialisée J-7 → J+2", category="Consultations", icon="consultation",
         description="Du rendez-vous confirmé à la clôture du dossier administratif, sans ressaisie à l'accueil.",
         anchor_label="Date de consultation", anchor="Consultation", owner="Secrétariat médical", outcome="Un accueil préparé, les coordonnées vérifiées et un suivi administratif tracé.",
         examples=["Première consultation", "Consultation de contrôle", "Avis spécialisé"], patient=["Amina","Berrada"], days=3,
         steps=[step(-7,"Confirmation du rendez-vous","message"),step(-5,"Vérification des coordonnées et du canal de contact"),
                doc(-3,"CIN ou passeport","cin"),doc(-3,"Attestation AMO si prise en charge demandée","attestation_amo",False),
                step(-2,"Questionnaire d'accueil administratif","questionnaire"),step(-1,"Rappel du rendez-vous et des modalités d'accès","message"),
                step(0,"Accueil et contrôle d'identité"),step(0,"Vérification du dossier de facturation"),
                step(1,"Transmission des justificatifs administratifs","message"),step(2,"Satisfaction et clôture administrative","questionnaire")]),
    dict(key="imagerie",name="Imagerie médicale J-7 → J+2",category="Examens",icon="imagerie",
         description="Préparer l'identité, la prescription transmise et la prise en charge avant l'examen.",
         anchor_label="Date de l'examen",anchor="Examen d'imagerie",owner="Accueil imagerie",outcome="Les pièces sont disponibles pour l'accueil ; l'équipe médicale conserve toutes les décisions sur l'examen.",
         examples=["IRM", "Scanner", "Échographie"],patient=["Youssef","Benali"],days=2,
         steps=[step(-7,"Enregistrement du rendez-vous"),doc(-5,"Prescription fournie par le patient","prescription"),
                doc(-5,"CIN ou passeport","cin"),doc(-4,"Attestation AMO si demandée","attestation_amo",False),
                doc(-3,"Accord de prise en charge si applicable","mutuelle",False),step(-2,"Revue administrative par l'accueil"),
                step(-1,"Transmission des informations pratiques validées par le service","message"),step(0,"Admission et vérification des pièces"),
                step(1,"Information sur le canal de remise des documents, selon le service","message"),step(2,"Clôture de la facturation et du parcours")]),
    dict(key="endoscopie",name="Endoscopie ambulatoire J-14 → J+3",category="Examens",icon="endoscopie",
         description="Coordonner l'admission, les pièces de couverture et les contacts avant un examen programmé.",
         anchor_label="Date de l'examen",anchor="Endoscopie",owner="Coordination endoscopie",outcome="Un dossier d'accueil complet et un circuit clair pour toute question à l'équipe soignante.",
         examples=["Endoscopie digestive programmée", "Examen ambulatoire"],patient=["Nadia","El Amrani"],days=5,
         steps=[step(-14,"Ouverture du dossier administratif"),doc(-10,"CIN ou passeport","cin"),doc(-10,"Attestation AMO (CNSS / CNOPS)","attestation_amo"),
                doc(-7,"Prise en charge assurance ou mutuelle si applicable","mutuelle",False),step(-7,"Questionnaire d'admission administratif","questionnaire"),
                step(-5,"Vérification des contacts et de l'accompagnement déclaré"),doc(-3,"Accord administratif signé","consentement_admin"),
                step(-2,"Confirmation de la réception des informations du service","task"),step(-1,"Horaire et accès à la clinique","message"),
                step(0,"Accueil administratif"),step(1,"Suivi des pièces de facturation"),step(3,"Satisfaction et clôture administrative","questionnaire")]),
    dict(key="ambulatoire",name="Chirurgie ambulatoire J-21 → J+7",category="Chirurgie",icon="chirurgie",
         description="Le parcours de référence : identité, AMO, prise en charge et coordination de J-21 à J+7.",
         anchor_label="Date d'intervention",anchor="Intervention ambulatoire",owner="Coordination ambulatoire",outcome="Les pièces manquantes sont visibles tôt et les relances sont préparées pour validation humaine.",
         examples=["Cataracte", "Arthroscopie", "Chirurgie ambulatoire programmée"],patient=["Khadija","Alaoui Démo"],days=8,
         steps=[step(*s[:3],document=s[3],blocking=s[4]) for s in svc.AMBULATORY_STEPS]),
    dict(key="hospitalisation",name="Hospitalisation programmée J-21 → J+14",category="Hospitalisation",icon="hospitalisation",
         description="Coordonner la préadmission, les garanties administratives, l'accueil et la clôture après séjour.",
         anchor_label="Date d'admission",anchor="Admission programmée",owner="Bureau des admissions",outcome="Une préadmission préparée et moins d'allers-retours administratifs pour le patient et sa famille.",
         examples=["Séjour chirurgical programmé", "Hospitalisation médicale programmée"],patient=["Hassan","Tazi"],days=6,
         steps=[step(-21,"Ouverture de la préadmission"),doc(-14,"CIN ou passeport","cin"),doc(-14,"Attestation AMO (CNSS / CNOPS)","attestation_amo"),
                doc(-10,"Accord de prise en charge si applicable","mutuelle",False),step(-7,"Validation du devis administratif et des modalités de règlement"),
                step(-5,"Recueil des préférences d'hébergement, sans garantie de disponibilité","questionnaire"),doc(-3,"Documents d'admission signés","consentement_admin"),
                step(-1,"Confirmation de l'horaire et des pièces à présenter","message"),step(0,"Admission administrative"),
                step(3,"Point administratif de séjour, à adapter à la durée réelle"),step(7,"Contrôle des pièces de sortie et de facturation"),
                step(14,"Clôture administrative, à replanifier selon la sortie réelle")]),
    dict(key="maternite",name="Maternité : admission et séjour J-30 → J+21",category="Hospitalisation",icon="maternite",
         description="Préparer le dossier maternel, les accords de couverture et les formalités de séjour avec la famille.",
         anchor_label="Date prévisionnelle d'admission",anchor="Admission maternité",owner="Admissions maternité",outcome="La famille connaît ses démarches et le dossier est ajustable si la date d'admission évolue.",
         examples=["Préadmission maternité", "Séjour programmé"],patient=["Salma","Bennani"],days=10,
         steps=[step(-30,"Préadmission et coordonnées de contact"),doc(-21,"CIN ou passeport de la patiente","cin"),
                doc(-21,"Attestation AMO si applicable","attestation_amo",False),doc(-14,"Accord de prise en charge si applicable","mutuelle",False),
                step(-10,"Présentation du devis et des modalités administratives"),step(-7,"Contact de la personne désignée et préférences d'accueil","questionnaire"),
                doc(-5,"Documents administratifs d'admission signés","consentement_admin",False),step(-2,"Informations pratiques et contact du service","message"),
                step(0,"Actualisation du dossier à l'admission réelle"),step(3,"Accompagnement des formalités de sortie selon la date réelle"),
                step(7,"Information sur les justificatifs administratifs à obtenir auprès de la clinique","message"),step(21,"Clôture administrative et satisfaction","questionnaire")]),
    dict(key="hopital_jour",name="Hôpital de jour : séance programmée J-14 → J+7",category="Séances",icon="jour",
         description="Préparer les pièces et l'accueil pour une séance prescrite, sans planifier le traitement médical.",
         anchor_label="Date de la séance",anchor="Séance d'hôpital de jour",owner="Secrétariat hôpital de jour",outcome="Un dossier de séance prêt ; les dates et le contenu des soins restent définis par l'équipe médicale.",
         examples=["Séance thérapeutique prescrite", "Bilan programmé en hôpital de jour"],patient=["Omar","Fassi"],days=4,
         steps=[step(-14,"Enregistrement de la séance communiquée par l'équipe médicale"),doc(-10,"CIN ou passeport","cin"),
                doc(-10,"Attestation AMO (CNSS / CNOPS)","attestation_amo"),doc(-7,"Accord de prise en charge de la séance si applicable","mutuelle",False),
                step(-5,"Vérification administrative de la période couverte par l'accord"),step(-2,"Confirmation des coordonnées et de l'horaire"),
                step(-1,"Rappel administratif de la séance","message"),step(0,"Accueil et pointage administratif"),
                step(1,"Vérification des justificatifs de facturation"),step(7,"Clôture de cette séance et information sur le prochain rendez-vous transmis")]),
    dict(key="reeducation",name="Rééducation : démarrage du suivi J-7 → J+14",category="Séances",icon="reeducation",
         description="Ouvrir le dossier, recueillir les pièces et coordonner les rendez-vous prescrits.",
         anchor_label="Date du premier rendez-vous",anchor="Premier rendez-vous de rééducation",owner="Secrétariat rééducation",outcome="Un démarrage organisé et un suivi administratif des rendez-vous, sans recommandation d'exercices.",
         examples=["Démarrage de kinésithérapie", "Suivi de rendez-vous prescrits"],patient=["Meryem","Zouiten"],days=3,
         steps=[step(-7,"Ouverture du dossier de suivi"),doc(-5,"CIN ou passeport","cin"),doc(-5,"Prescription remise par le patient","prescription"),
                doc(-4,"Accord de prise en charge si applicable","mutuelle",False),step(-3,"Recueil des disponibilités de rendez-vous","questionnaire"),
                step(-1,"Confirmation du premier rendez-vous et des modalités d'accès","message"),step(0,"Accueil et vérification administrative"),
                step(3,"Suivi administratif des rendez-vous convenus"),step(7,"Contrôle des justificatifs pour remboursement"),
                step(14,"Bilan administratif du démarrage et suivi des démarches restantes")]),
    dict(key="admission_non_programmee",name="Admission non programmée J0 → J+7",category="Hospitalisation",icon="admission",
         description="Régulariser le dossier après l'accueil, sans faire de l'administratif un préalable aux soins urgents.",
         anchor_label="Date d'admission",anchor="Admission non programmée",owner="Admissions et permanence",outcome="Un suivi des pièces différées et des contacts familiaux sans automatiser le triage médical.",
         examples=["Régularisation après admission imprévue", "Dossier constitué avec l'accompagnant"],patient=["Rachid","El Mansouri"],days=0,
         steps=[step(0,"Enregistrement administratif minimal après accueil"),step(0,"Orientation vers l'équipe habilitée et vérification des contacts"),
                step(1,"Recueil différé des coordonnées du patient ou de la personne habilitée","questionnaire"),
                doc(1,"CIN ou passeport à régulariser","cin",False),doc(2,"Justificatif de couverture si disponible","attestation_amo",False),
                step(2,"Identification des démarches de prise en charge applicables"),doc(3,"Documents administratifs à régulariser","consentement_admin",False),
                step(3,"Point de coordination avec la famille ou la personne habilitée"),step(5,"Vérification des pièces de facturation"),
                step(7,"Clôture ou poursuite du suivi selon le séjour réel")]),
]
BY_KEY = {b["key"]: b for b in CATALOGUE}
BY_NAME = {b["name"]: b for b in CATALOGUE}


def metadata(name):
    b = BY_NAME.get(name)
    return {k:b[k] for k in ("key","category","anchor","anchor_label","description","outcome")} if b else None


def install(db, est_id, key, *, published=False):
    b = BY_KEY[key]
    versions = list(db.scalars(select(m.JourneyTemplate).where(m.JourneyTemplate.establishment_id==est_id,m.JourneyTemplate.name==b["name"]).order_by(m.JourneyTemplate.version.desc())))
    old = next((t for t in versions if t.status=="published"), versions[0] if versions else None)
    if old:
        return old, False
    # Deterministic key makes a second installation unambiguously refer to the same initial template.
    t=m.JourneyTemplate(id=uuid.uuid5(uuid.NAMESPACE_URL,f"m3aya:{est_id}:catalogue:{key}:1"),establishment_id=est_id,name=b["name"],status="published" if published else "draft")
    t.steps=[m.TemplateStep(**s) for s in b["steps"]]
    db.add(t); db.flush()
    return t, True


def install_demo(db, est_id):
    return sum(install(db,est_id,b["key"],published=True)[1] for b in CATALOGUE)


def listing(db, est_id):
    templates=list(db.scalars(select(m.JourneyTemplate).where(m.JourneyTemplate.establishment_id==est_id)))
    out=[]
    for b in CATALOGUE:
        versions=[t for t in templates if t.name==b["name"]]
        active=sorted([t for t in versions if t.status=="published"],key=lambda t:t.version,reverse=True)
        latest=max(versions,key=lambda t:t.version) if versions else None
        t=active[0] if active else latest
        steps = [{"offset_days":s.offset_days,"title":s.title,"kind":s.kind,"required_document":s.required_document,"blocking":s.blocking} for s in t.steps] if t else b["steps"]
        out.append({**{k:v for k,v in b.items() if k not in ("patient","days")}, "steps":steps,
                    "template_id":str(t.id) if t else None,"status":t.status if t else "not_installed","version":t.version if t else None,
                    "duration":{"start":min((s["offset_days"] for s in steps),default=0),"end":max((s["offset_days"] for s in steps),default=0)},
                    "documents":list(dict.fromkeys(s["title"] for s in steps if s["kind"]=="document"))})
    return out


if __name__=="__main__":
    from sqlalchemy.orm import Session
    from app.core import get_settings, init_engine
    if get_settings().demo_mode:
        with Session(init_engine()) as db:
            count=sum(install_demo(db,e.id) for e in db.scalars(select(m.Establishment)))
            db.commit()
            print(f"M3aya catalogue: {count} reference templates added; existing journeys preserved.")
