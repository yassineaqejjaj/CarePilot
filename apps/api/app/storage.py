"""Stockage des pièces patient : validation du contenu, chiffrement applicatif (Fernet), puis base ou disque."""
from __future__ import annotations

import hashlib
import pathlib
import re
import uuid
from functools import lru_cache

from cryptography.fernet import Fernet
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models as m
from app.core import get_settings

DEV_KEY = Fernet.generate_key  # la clé de dev est dérivée ci-dessous, jamais utilisée hors dev/test


@lru_cache
def _fernet() -> Fernet:
    s = get_settings()
    if s.file_encryption_key:
        return Fernet(s.file_encryption_key.encode())
    # dev/test uniquement (get_settings refuse l'absence de clé ailleurs) : clé déterministe locale
    import base64
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(b"carepilot-dev-only-file-key").digest()))


def sniff(data: bytes) -> tuple[str, str] | None:
    """Type réel d'après les octets (le type annoncé par le client n'est pas fiable). Retourne (mime, extension)."""
    if data.startswith(b"%PDF-"):
        return "application/pdf", "pdf"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", "jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", "png"
    if data[4:12] in (b"ftypheic", b"ftypheix", b"ftypmif1", b"ftypheif"):
        return "image/heic", "heic"
    return None


def safe_name(name: str, ext: str) -> str:
    base = re.sub(r"[^\w.\- ]", "_", pathlib.Path(name or "document").stem)[:60] or "document"
    return f"{base}.{ext}"


def save_upload(db: Session, est_id: uuid.UUID, journey_id: uuid.UUID, task_id: uuid.UUID, filename: str,
                data: bytes, uploaded_by: str) -> m.Document:
    s = get_settings()
    if not data:
        raise HTTPException(422, "Fichier vide")
    if len(data) > s.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"Fichier trop volumineux (max {s.max_upload_mb} Mo)")
    kind = sniff(data)
    if kind is None:
        raise HTTPException(415, "Format non accepté : PDF, JPEG, PNG ou HEIC uniquement")
    mime, ext = kind
    key = uuid.uuid4().hex
    token = _fernet().encrypt(data)
    if s.storage_backend == "local":
        d = pathlib.Path(s.storage_dir)
        d.mkdir(parents=True, exist_ok=True)
        (d / key).write_bytes(token)
    else:
        db.add(m.StoredFile(key=key, data=token))
    doc = m.Document(establishment_id=est_id, journey_id=journey_id, task_id=task_id, filename=safe_name(filename, ext),
                     content_type=mime, size=len(data), sha256=hashlib.sha256(data).hexdigest(), storage_key=key,
                     uploaded_by=uploaded_by)
    db.add(doc)
    return doc


def read_file(db: Session, doc: m.Document) -> bytes:
    s = get_settings()
    if s.storage_backend == "local":
        token = (pathlib.Path(s.storage_dir) / doc.storage_key).read_bytes()
    else:
        row = db.get(m.StoredFile, doc.storage_key)
        if row is None:
            raise HTTPException(404, "Fichier introuvable")
        token = row.data
    return _fernet().decrypt(token)


def delete_file(db: Session, doc: m.Document) -> None:
    s = get_settings()
    if s.storage_backend == "local":
        (pathlib.Path(s.storage_dir) / doc.storage_key).unlink(missing_ok=True)
    else:
        row = db.get(m.StoredFile, doc.storage_key)
        if row is not None:
            db.delete(row)
