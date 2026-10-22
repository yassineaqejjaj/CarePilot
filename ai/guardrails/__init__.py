"""Garde-fous : redaction d'identifiants directs, blocage de contenu médical, périmètre des sorties.

Limite connue : la redaction par regex ne détecte PAS les noms propres en texte libre.
Elle réduit le risque, elle ne l'élimine pas ; d'où la règle « données fictives uniquement »
tant que la validation juridique n'est pas faite.
"""
from __future__ import annotations

import re

_PATTERNS = {
    "EMAIL": re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+"),
    # NIR français : 13 chiffres + clé de 2 (espaces tolérés)
    "NIR": re.compile(r"\b[12]\s?\d{2}\s?\d{2}\s?(?:\d{2}|2[AB])\s?\d{3}\s?\d{3}(?:\s?\d{2})?\b"),
    "PHONE": re.compile(r"(?<!\d)(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}(?!\d)"),
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
