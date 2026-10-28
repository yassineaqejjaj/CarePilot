"""Création de patients et de parcours (manuelle et par import CSV)."""
from __future__ import annotations

import csv
import datetime as dt
import io
import uuid

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models as m
from app import services as svc
from app.core import Principal, today
from app.moroccan import normalize_ma_phone, parse_birth_date

MAX_CSV_ROWS = 500
LANGS = ("fr", "ar")
CHANNELS = ("whatsapp", "sms", "email")


def pseudo_ref() -> str:
    h = uuid.uuid4().hex
    return f"PT-{h[:4]}-{h[4:8]}"  # groupes de 4 : ne ressemble ni à une CIN ni à un numéro de sécurité sociale


def next_reference(db: Session, est_id: uuid.UUID) -> str:
    n = db.scalar(select(func.count()).select_from(m.PatientJourney).where(m.PatientJourney.establishment_id == est_id)) or 0
    return f"PAR-{today().year}-{n + 1:05d}"


def make_patient(db: Session, est_id: uuid.UUID, *, first_name: str, last_name: str, birth_date: str | dt.date | None = None,
                 phone: str = "", email: str = "", language: str = "fr", preferred_channel: str = "whatsapp") -> m.Patient:
    if not first_name.strip() or not last_name.strip():
        raise ValueError("Nom et prénom requis")
    ph = ""
    if phone.strip():
        ph = normalize_ma_phone(phone) or ""
        if not ph:
            raise ValueError("Numéro de téléphone marocain invalide (ex. 06 12 34 56 78 ou +212 6 12 34 56 78)")
    bd = birth_date if isinstance(birth_date, dt.date) or birth_date is None else (parse_birth_date(birth_date) if birth_date.strip() else None)
    if birth_date and bd is None:
        raise ValueError("Date de naissance invalide (JJ/MM/AAAA)")
    if language not in LANGS:
        raise ValueError("Langue : fr ou ar")
    if preferred_channel not in CHANNELS:
        raise ValueError("Canal : whatsapp, sms ou email")
    pat = m.Patient(establishment_id=est_id, ref=pseudo_ref(), first_name=first_name.strip(), last_name=last_name.strip(),
                    birth_date=bd, phone=ph, email=email.strip(), language=language, preferred_channel=preferred_channel)
    db.add(pat)
    db.flush()
    return pat


def default_template(db: Session, est_id: uuid.UUID) -> m.JourneyTemplate:
    t = db.scalar(select(m.JourneyTemplate).where(m.JourneyTemplate.establishment_id == est_id, m.JourneyTemplate.status == "published")
                  .order_by(m.JourneyTemplate.version.desc()))
    if t is None:
        raise HTTPException(409, "Aucun parcours publié : publiez un modèle dans le concepteur")
    return t


def make_journey(db: Session, p: Principal, patient: m.Patient, *, surgery_date: dt.date, procedure: str = "", surgeon: str = "",
                 owner: str = "", admission_time: str = "08:00", template: m.JourneyTemplate | None = None) -> m.PatientJourney:
    tpl = template or default_template(db, p.establishment_id)
    j = svc.instantiate_journey(db, tpl, patient, surgery_date)
    j.reference, j.procedure, j.surgeon = next_reference(db, p.establishment_id), procedure.strip(), surgeon.strip()
    j.owner, j.admission_time = owner.strip() or p.name or p.email, admission_time
    db.flush()
    svc.audit(db, p, "journey.create", "patient_journey", j.id, tasks=len(j.tasks), journey_id=str(j.id))
    return j


def import_csv(db: Session, p: Principal, text: str, dry_run: bool = False) -> dict:
    """Colonnes : first_name,last_name,surgery_date (obligatoires) ; birth_date,phone,email,procedure,surgeon,owner,language,channel."""
    text = text.lstrip("﻿")
    try:
        dialect = csv.Sniffer().sniff(text[:2000], delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    rows = list(csv.DictReader(io.StringIO(text), dialect=dialect))
    if len(rows) > MAX_CSV_ROWS:
        raise HTTPException(413, f"Maximum {MAX_CSV_ROWS} lignes par import")
    tpl = default_template(db, p.establishment_id)
    created, errors = 0, []
    for i, raw in enumerate(rows, start=2):  # ligne 1 = en-têtes
        r = {(k or "").strip().lower(): (v or "").strip() for k, v in raw.items()}
        try:
            sd = parse_birth_date_any(r.get("surgery_date", ""))
            if sd is None:
                raise ValueError("Date d'intervention invalide (JJ/MM/AAAA ou AAAA-MM-JJ)")
            with db.begin_nested():  # un enregistrement invalide n'annule pas les autres
                pat = make_patient(db, p.establishment_id, first_name=r.get("first_name", ""), last_name=r.get("last_name", ""),
                                   birth_date=r.get("birth_date", ""), phone=r.get("phone", ""), email=r.get("email", ""),
                                   language=r.get("language", "") or "fr", preferred_channel=r.get("channel", "") or "whatsapp")
                make_journey(db, p, pat, surgery_date=sd, procedure=r.get("procedure", ""), surgeon=r.get("surgeon", ""),
                             owner=r.get("owner", ""), template=tpl)
                if dry_run:
                    raise _Rollback()
            created += 1
        except _Rollback:
            created += 1
        except (ValueError, HTTPException) as exc:
            errors.append({"line": i, "error": exc.detail if isinstance(exc, HTTPException) else str(exc)})
    return {"created": created, "errors": errors, "dry_run": dry_run}


class _Rollback(Exception):
    pass


def parse_birth_date_any(raw: str) -> dt.date | None:
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return dt.datetime.strptime(raw.strip(), fmt).date()
        except ValueError:
            continue
    return None
