"""Envoi de SMS / WhatsApp / e-mail. Fournisseur « console » (simulé) par défaut, « live » = SMTP + Twilio.

Le journal `message_log` conserve statut et destinataire MASQUÉ ; il prouve ce qui est parti, sans dupliquer le numéro.
Les messages sont strictement administratifs (voir templates_msg).
"""
from __future__ import annotations

import logging
import datetime as dt
from zoneinfo import ZoneInfo
from sqlalchemy import select
import smtplib
import uuid
from dataclasses import dataclass
from email.message import EmailMessage

import httpx
from sqlalchemy.orm import Session

from app import models as m
from app.core import get_settings
from app.moroccan import mask_email, mask_phone

log = logging.getLogger("carepilot.messaging")


@dataclass
class SendResult:
    status: str  # simulated | sent | failed
    provider_ref: str = ""
    error: str = ""


class ConsoleProvider:
    def send(self, channel: str, to: str, subject: str, body: str) -> SendResult:
        log.info("message simulé channel=%s", channel)  # ni destinataire ni contenu dans les logs
        return SendResult("simulated", provider_ref="console")


class LiveProvider:
    def send(self, channel: str, to: str, subject: str, body: str) -> SendResult:
        s = get_settings()
        try:
            if channel == "email":
                if not (s.smtp_host and s.smtp_from):
                    return SendResult("failed", error="SMTP non configuré")
                msg = EmailMessage()
                msg["From"], msg["To"], msg["Subject"] = s.smtp_from, to, subject
                msg.set_content(body)
                with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=15) as smtp:
                    smtp.starttls()
                    if s.smtp_user:
                        smtp.login(s.smtp_user, s.smtp_password)
                    smtp.send_message(msg)
                return SendResult("sent", provider_ref="smtp")
            sender = s.twilio_whatsapp_from if channel == "whatsapp" else s.twilio_sms_from
            if not (s.twilio_account_sid and s.twilio_auth_token and sender):
                return SendResult("failed", error=f"Canal {channel} non configuré")
            dest = f"whatsapp:{to}" if channel == "whatsapp" else to
            frm = f"whatsapp:{sender}" if channel == "whatsapp" and not sender.startswith("whatsapp:") else sender
            r = httpx.post(f"https://api.twilio.com/2010-04-01/Accounts/{s.twilio_account_sid}/Messages.json",
                           data={"To": dest, "From": frm, "Body": body}, auth=(s.twilio_account_sid, s.twilio_auth_token), timeout=15)
            if r.status_code >= 300:
                return SendResult("failed", error=f"HTTP {r.status_code}")
            return SendResult("sent", provider_ref=str(r.json().get("sid", ""))[:80])
        except Exception as exc:  # réseau, SMTP, JSON : on journalise le type seulement
            return SendResult("failed", error=type(exc).__name__)


class BrevoProvider:
    """Brevo server-side transport. No retry on an ambiguous network result."""
    def send(self, channel: str, to: str, subject: str, body: str) -> SendResult:
        s=get_settings()
        if not s.brevo_api_key:return SendResult("failed",error="Clé Brevo absente")
        if channel=="email":
            if not s.brevo_sender_email:return SendResult("failed",error="Expéditeur Brevo non configuré")
            endpoint="smtp/email";payload={"sender":{"email":s.brevo_sender_email,"name":s.brevo_sender_name},"to":[{"email":to}],"subject":subject,"textContent":body}
        elif channel=="sms":
            endpoint="transactionalSMS/send";payload={"sender":s.brevo_sms_sender,"recipient":to.lstrip('+'),"content":body,"type":"transactional","unicodeEnabled":True}
        elif channel=="whatsapp":
            template=s.brevo_whatsapp_template_ar if any('\u0600'<=c<='\u06ff' for c in body) else s.brevo_whatsapp_template_fr
            if not template or not s.brevo_whatsapp_sender:return SendResult("failed",error="Modèle WhatsApp approuvé et expéditeur requis")
            if 'http' in body:return SendResult("failed",error="Invitation avec lien : utilisez e-mail/SMS ou transmettez le lien manuellement ; modèle WhatsApp dynamique non configuré")
            endpoint="whatsapp/sendMessage";payload={"senderNumber":s.brevo_whatsapp_sender.lstrip('+'),"contactNumbers":[to.lstrip('+')],"templateId":template}
        else:return SendResult("failed",error="Canal inconnu")
        try:
            r=httpx.post("https://api.brevo.com/v3/"+endpoint,json=payload,headers={"api-key":s.brevo_api_key,"accept":"application/json"},timeout=15)
            if r.status_code>=300:return SendResult("failed",error="Brevo HTTP "+str(r.status_code))
            ref=str(r.json().get("messageId", ""))[:80]
            return SendResult("sent",provider_ref=ref)
        except Exception as exc:return SendResult("failed",error=type(exc).__name__+" : vérifier le fournisseur avant tout nouvel envoi")


def get_provider():
    return BrevoProvider() if get_settings().messaging_provider == "brevo" else LiveProvider() if get_settings().messaging_provider == "live" else ConsoleProvider()


def pick_channel(patient: m.Patient) -> tuple[str, str] | None:
    """Canal et adresse à utiliser : préférence du patient, avec repli sur ce qui est renseigné."""
    order = [patient.preferred_channel] + [c for c in ("whatsapp", "sms", "email") if c != patient.preferred_channel]
    for c in order:
        if c in ("whatsapp", "sms") and patient.phone:
            return c, patient.phone
        if c == "email" and patient.email:
            return "email", patient.email
    return None


def send_to_patient(db: Session, est_id: uuid.UUID, patient: m.Patient, journey_id: uuid.UUID | None,
                    kind: str, subject: str, body: str, channel: str | None = None) -> m.MessageLog:
    s=get_settings()
    preference=db.get(m.PatientContactPreference,patient.id)
    policy_error="Rappels désactivés à la demande du patient" if preference and not preference.enabled and kind in ("reminder","info") else ""
    if journey_id:
        db.execute(select(m.PatientJourney.id).where(m.PatientJourney.id==journey_id).with_for_update())
    if not policy_error and kind in ("reminder","info") and s.messaging_provider!="console":
        from app.compliance import has_consent
        prefs=db.get(m.FacilityPreferences,est_id)
        hour=dt.datetime.now(ZoneInfo(s.timezone)).hour
        start=prefs.contact_start_hour if prefs else 8;end=prefs.contact_end_hour if prefs else 20
        if not has_consent(db,patient.id):policy_error="Accord patient requis avant une relance"
        elif not start<=hour<end:policy_error="Hors plage d’envoi configurée"
        elif db.scalar(select(m.MessageLog.id).where(m.MessageLog.journey_id==journey_id,m.MessageLog.kind.in_(["reminder","info"]),m.MessageLog.status.in_(["sent","delivered"]),m.MessageLog.created_at>=dt.datetime.now(dt.timezone.utc)-dt.timedelta(hours=24)).limit(1)):policy_error="Un rappel a déjà été transmis depuis moins de 24 heures"
    chosen = pick_channel(patient)
    if channel and channel != "auto":
        available = (channel in ("whatsapp", "sms") and patient.phone) or (channel == "email" and patient.email)
        chosen = (channel, patient.phone if channel != "email" else patient.email) if available else None
    if policy_error:
        res,ch,to=SendResult("failed",error=policy_error),chosen[0] if chosen else channel or "sms",chosen[1] if chosen else ""
    elif patient.anonymized_at or chosen is None:
        res, ch, to = SendResult("failed", error="Aucun canal de contact valide"), channel or "sms", ""
    else:
        ch, to = chosen
        res = get_provider().send(ch, to, subject, body)
    row = m.MessageLog(establishment_id=est_id, journey_id=journey_id, patient_id=patient.id, kind=kind, channel=ch,
                       to_masked=(mask_email(to) if ch == "email" else mask_phone(to)) if to else "",
                       subject=subject[:200], status=res.status, provider_ref=res.provider_ref, error=res.error[:300])
    db.add(row)
    return row
