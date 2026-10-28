"""Garde-fous : redaction d'identifiants directs, blocage de contenu médical, périmètre des sorties.

Adapté au Maroc : CIN, numéros +212, numéros CNSS/CNOPS, e-mail.
Limite connue : la redaction par regex ne détecte PAS les noms propres en texte libre.
Elle réduit le risque, elle ne l'élimine pas ; d'où la règle « données fictives uniquement »
tant que la validation juridique n'est pas faite.
"""
from __future__ import annotations

import re

_PATTERNS = {
    "EMAIL": re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+"),
    # CIN marocaine : 1 à 2 lettres suivies de 5 à 8 chiffres (ex. AB123456, K123456)
    "CIN": re.compile(r"\b[A-Za-z]{1,2}\s?\d{5,8}\b"),
    # Téléphone marocain : +212 / 00212 / 0 suivi de 5, 6, 7 ou 8 puis 8 chiffres (séparateurs tolérés)
    "PHONE": re.compile(r"(?<![\w])(?:\+212|00212|0)[\s.-]?[5-8](?:[\s.-]?\d){8}(?!\d)"),
    # Numéro d'immatriculation CNSS / CNOPS : suite de 9 à 12 chiffres
    "SOCIAL_ID": re.compile(r"(?<!\d)\d{9,12}(?!\d)"),
}

MEDICAL_ADVICE_TERMS = (
    "diagnostic", "posologie", "dosage", "prescri", "arrêtez votre traitement",
    "arretez votre traitement", "augmentez la dose", "vous souffrez de",
)


def redact(text: str) -> tuple[str, list[str]]:
    """Remplace les identifiants directs par des jetons. Retourne (texte, types détectés)."""
    found: list[str] = []
    for label, pattern in _PATTERNS.items():
        if pattern.search(text):
            found.append(label)
            text = pattern.sub(f"[{label}]", text)
    return text, found


def contains_direct_identifier(text: str) -> bool:
    return any(p.search(text) for p in _PATTERNS.values())


def medical_advice_terms(text: str) -> list[str]:
    low = text.lower()
    return [t for t in MEDICAL_ADVICE_TERMS if t in low]
