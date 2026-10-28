"""On-server OCR (Tesseract, Poppler), deterministic checks. No file or OCR text goes to an LLM."""
from __future__ import annotations

import csv
import datetime as dt
import io
import json
import itertools
import re
import shutil
import subprocess
import tempfile
import threading
from pathlib import Path

from app import models as m, storage
from app.core import today

_slots = threading.BoundedSemaphore(2)

TYPE_WORDS = {
    "cin": ("identite", "identité", "nationale", "passeport", "المملكة", "بطاقة", "الوطنية"),
    "attestation_amo": ("amo", "cnss", "cnops", "assurance maladie", "التأمين", "الصندوق"),
    "mutuelle": ("mutuelle", "prise en charge", "assurance", "تغطية", "التكفل"),
    "consentement_admin": ("consentement", "autorisation", "consent", "موافقة"),
}


def _run(args: list[str], timeout=20) -> str:
    return subprocess.run(args, check=True, capture_output=True, timeout=timeout).stdout.decode("utf-8", errors="replace")


def extract_text(data: bytes, mime: str) -> tuple[str, str, float | None]:
    """Bounded execution: first 2 PDF pages / 1 image. PDF embedded text first, then local OCR."""
    with tempfile.TemporaryDirectory(prefix="cp-ocr-") as tmp:
        src = Path(tmp) / ("source.pdf" if mime == "application/pdf" else "source.img")
        src.write_bytes(data)
        if mime == "application/pdf" and not shutil.which("pdftotext"):
            from pypdf import PdfReader
            try:
                pdf = PdfReader(io.BytesIO(data))
                text = "\n".join(page.extract_text() or "" for page in itertools.islice(pdf.pages, 2))[:20000]
                if len(re.sub(r"\s", "", text)) >= 30:
                    return text, "pdf-text-local", None
            except Exception:
                pass
        if mime == "application/pdf" and shutil.which("pdftotext"):
            text = _run(["pdftotext", "-f", "1", "-l", "2", "-layout", str(src), "-"])
            if len(re.sub(r"\s", "", text)) >= 30:
                return text[:20000], "pdf-text-local", None
        if not shutil.which("tesseract"):
            return "", "unavailable", None
        images = [src]
        if mime == "application/pdf":
            if not shutil.which("pdftoppm"):
                return "", "unavailable", None
            _run(["pdftoppm", "-f", "1", "-l", "2", "-scale-to", "1800", "-png", str(src), str(Path(tmp) / "page")])
            images = sorted(Path(tmp).glob("page-*.png"))
        text, confidence = [], []
        for image in images:
            tsv = _run(["tesseract", str(image), "stdout", "-l", "fra+ara+eng", "--psm", "3", "tsv"])
            for r in csv.DictReader(io.StringIO(tsv), delimiter="\t"):
                word = (r.get("text") or "").strip()
                if word:
                    text.append(word)
                    c = float(r.get("conf", "-1"))
                    if c >= 0:
                        confidence.append(c)
        return " ".join(text)[:20000], "tesseract-local", round(sum(confidence) / len(confidence)) if confidence else None


def inspect_text(text: str, expected: str | None, *, engine: str, quality: float | None = None, on_date: dt.date | None = None) -> dict:
    low = text.casefold()
    scores = {k: sum(w in low for w in words) for k, words in TYPE_WORDS.items()}
    guessed = max(scores, key=scores.get) if any(scores.values()) else "unknown"
    fields, warnings = [], []
    cin = re.search(r"\b[A-Z]{1,2}\s?\d{5,8}\b", text)
    if cin:
        fields.append({"key": "cin", "label": "CIN détectée", "value": cin.group().replace(" ", ""), "source": "Texte de la pièce"})
    for key, label, pattern in (
        ("holder", "Titulaire indiqué", r"(?:titulaire|assur[ée]\s*\(e\))\s*:\s*([^\n\r]{3,70}?)(?=\s+(?:organisme|valable|expir|numero|numéro)\b|[\n\r]|$)"),
        ("organization", "Organisme indiqué", r"organisme\s*:\s*([^\n\r]{3,70}?)(?=\s+(?:valable|expir|numero|numéro)\b|[\n\r]|$)"),
    ):
        match = re.search(pattern, text, re.I)
        if match:
            fields.append({"key": key, "label": label, "value": match.group(1).strip(), "source": "Libellé du document"})
    # Only explicitly labelled expiration dates; never guess from birth / issue dates.
    exp = re.search(r"(?:expir\w*|valable\s+(?:au|jusqu.?au)|valid\s+until|fin\s+de\s+validit[ée])\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4}|\d{4}-\d{2}-\d{2})", low)
    if exp:
        parsed = None
        for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y", "%Y-%m-%d"):
            try:
                parsed = dt.datetime.strptime(exp.group(1), fmt).date()
                break
            except ValueError:
                pass
        if parsed:
            fields.append({"key": "expires_on", "label": "Fin de validité", "value": parsed.isoformat(), "source": exp.group(0)})
            if parsed < (on_date or today()):
                warnings.append("La date de fin de validité détectée est dépassée. Vérifiez la pièce.")
    if len(re.sub(r"\s", "", text)) < 20:
        warnings.append("Texte insuffisant : photo floue, format non lisible ou document sans texte. Revue manuelle nécessaire.")
    if quality is not None and quality < 60:
        warnings.append("Lecture difficile : vérifier le cadrage et la netteté de la photo.")
    # An AMO certificate also contains 'assurance'; treat expected type as supported if its own keywords match.
    if expected in scores and scores[expected] == 0 and guessed != "unknown":
        warnings.append("Le type détecté ne correspond peut-être pas à la pièce attendue.")
    return {"engine": engine, "detected_type": guessed, "expected_type": expected, "quality_score": quality,
            "fields": fields, "warnings": warnings, "review_required": True,
            "notice": "Lecture locale indicative : vérifiez sur l'original. Aucun champ ni statut n'a été validé automatiquement."}


def analyze_document(db, doc: m.Document) -> dict:
    from fastapi import HTTPException
    if not _slots.acquire(blocking=False):
        raise HTTPException(429, "Deux lectures sont en cours. Réessayez dans un instant.")
    try:
        return _analyze_document(db, doc)
    finally:
        _slots.release()


def _analyze_document(db, doc: m.Document) -> dict:
    task = db.get(m.Task, doc.task_id)
    try:
        text, engine, quality = extract_text(storage.read_file(db, doc), doc.content_type)
        report = inspect_text(text, task.required_document, engine=engine, quality=quality)
    except (subprocess.SubprocessError, OSError, ValueError):
        report = inspect_text("", task.required_document, engine="failed")
    row = db.get(m.DocumentReading, doc.id)
    encrypted = storage._fernet().encrypt(json.dumps(report, ensure_ascii=False).encode())
    if row is None:
        db.add(m.DocumentReading(document_id=doc.id, establishment_id=doc.establishment_id, encrypted_report=encrypted))
    else:
        row.encrypted_report = encrypted
    return report


def saved_report(db, doc_id) -> dict | None:
    row = db.get(m.DocumentReading, doc_id)
    return json.loads(storage._fernet().decrypt(row.encrypted_report)) if row else None
