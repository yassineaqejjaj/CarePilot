"""Particularités marocaines : numéros de téléphone (+212), masquage, date de naissance."""
from __future__ import annotations

import datetime as dt
import re


def normalize_ma_phone(raw: str) -> str | None:
    """Retourne le numéro en E.164 (+212XXXXXXXXX) ou None s'il est invalide.

    Accepte : 06 12 34 56 78, 0612345678, +212 6 12 34 56 78, 00212612345678, 212612345678.
    Numéros nationaux à 9 chiffres commençant par 5 (fixe), 6/7 (mobile) ou 8 (services).
    """
    digits = re.sub(r"[^\d+]", "", raw or "")
    if digits.startswith("+212"):
        national = digits[4:]
    elif digits.startswith("00212"):
        national = digits[5:]
    elif digits.startswith("212") and len(digits) == 12:
        national = digits[3:]
    elif digits.startswith("0") and len(digits) == 10:
        national = digits[1:]
    else:
        return None
    if not re.fullmatch(r"[5-8]\d{8}", national):
        return None
    return "+212" + national


def mask_phone(e164: str) -> str:
    return f"{e164[:5]}•••••{e164[-2:]}" if len(e164) >= 9 else "•••"


def mask_email(email: str) -> str:
    if "@" not in email:
        return "•••"
    user, dom = email.split("@", 1)
    return f"{user[:1]}•••@{dom}"


def parse_birth_date(raw: str) -> dt.date | None:
    """Accepte AAAA-MM-JJ ou JJ/MM/AAAA (saisie courante au Maroc)."""
    raw = (raw or "").strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            d = dt.datetime.strptime(raw, fmt).date()
            return d if dt.date(1900, 1, 1) <= d <= dt.date.today() else None
        except ValueError:
            continue
    return None
