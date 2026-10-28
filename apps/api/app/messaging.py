"""Envoi de SMS / WhatsApp / e-mail. Fournisseur « console » (simulé) par défaut, « live » = SMTP + Twilio.

Le journal `message_log` conserve statut et destinataire MASQUÉ ; il prouve ce qui est parti, sans dupliquer le numéro.
Les messages sont strictement administratifs (voir templates_msg).
"""
from __future__ import annotations

import logging
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


def get_provider():
    return LiveProvider() if get_settings().messaging_provider == "live" else ConsoleProvider()


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
    chosen = pick_channel(patient)
    if channel and channel != "auto" and ((channel in ("whatsapp", "sms") and patient.phone) or (channel == "email" and patient.email)):
        chosen = (channel, patient.phone if channel != "email" else patient.email)
    if patient.anonymized_at or chosen is None:
        res, ch, to = SendResult("failed", error="Aucun canal de contact valide"), channel or "sms", ""
    else:
        ch, to = chosen
        res = get_provider().send(ch, to, subject, body)
    row = m.MessageLog(establishment_id=est_id, journey_id=journey_id, patient_id=patient.id, kind=kind, channel=ch,
                       to_masked=(mask_email(to) if ch == "email" else mask_phone(to)) if to else "",
                       subject=subject[:200], status=res.status, provider_ref=res.provider_ref, error=res.error[:300])
    db.add(row)
    return row
