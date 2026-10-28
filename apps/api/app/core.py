"""Configuration, base de données et sécurité (OIDC/RBAC) regroupées."""
from __future__ import annotations

import datetime as dt
import uuid
from zoneinfo import ZoneInfo
from dataclasses import dataclass
from functools import lru_cache
from typing import Iterator

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "dev"
    database_url: str = "postgresql+psycopg://carepilot:carepilot@localhost:5432/carepilot"
    auth_mode: str = "oidc"  # "oidc" | "test" (interdit hors dev/test)
    oidc_issuer: str = "http://localhost:8080/realms/carepilot"
    oidc_audience: str = "carepilot-api"
    jwt_test_secret: str = "test-secret-do-not-use-in-prod-0123456789"
    ai_enabled: bool = True  # kill-switch global
    embedding_dim: int = 1536
    default_monthly_token_budget: int = 2_000_000
    minutes_saved_per_automated_task: int = 6
    timezone: str = "Africa/Casablanca"
    public_web_url: str = "http://localhost:5173"  # base des liens patient
    # Session patient (lien sécurisé) : secret propre, distinct de Keycloak
    patient_session_secret: str = "dev-only-patient-session-secret-change-me-0123456789"
    patient_session_hours: int = 12
    invitation_hours: int = 72
    invitation_max_attempts: int = 5
    # Messagerie : "console" (simulée) ou "live" (SMTP + Twilio SMS/WhatsApp)
    messaging_provider: str = "console"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    brevo_api_key: str = ""
    brevo_sender_email: str = ""
    brevo_sender_name: str = "M3aya Santé"
    brevo_sms_sender: str = "M3aya"
    brevo_whatsapp_sender: str = ""
    brevo_whatsapp_template_fr: int = 0
    brevo_whatsapp_template_ar: int = 0
    messaging_webhook_secret: str = ""
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_sms_from: str = ""
    twilio_whatsapp_from: str = ""
    # Fichiers patient : chiffrés applicativement (Fernet) puis stockés en base ("db") ou sur disque ("local")
    storage_backend: str = "db"
    storage_dir: str = "./data/files"
    file_encryption_key: str = ""  # clé Fernet (base64 urlsafe 32 octets). Obligatoire hors dev/test.
    max_upload_mb: int = 10
    rate_limit_enabled: bool = True
    demo_mode: bool = False  # autorise la réinitialisation des données de démonstration (JAMAIS en exploitation réelle)


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.auth_mode == "test" and s.env not in ("dev", "test"):
        raise RuntimeError("AUTH_MODE=test interdit en dehors de dev/test")
    if s.env not in ("dev", "test"):
        if s.patient_session_secret.startswith("dev-only") or len(s.patient_session_secret) < 32:
            raise RuntimeError("PATIENT_SESSION_SECRET doit être défini (>= 32 caractères) hors dev/test")
        if not s.file_encryption_key:
            raise RuntimeError("FILE_ENCRYPTION_KEY doit être défini hors dev/test")
    return s


def today() -> "dt.date":
    """Date du jour dans le fuseau de l'établissement (Maroc : Africa/Casablanca), pas celui du serveur."""
    return dt.datetime.now(ZoneInfo(get_settings().timezone)).date()


_engine = None
_SessionLocal = None


def init_engine(url: str | None = None):
    global _engine, _SessionLocal
    _engine = create_engine(url or get_settings().database_url, future=True)
    _SessionLocal = sessionmaker(_engine, expire_on_commit=False)
    return _engine


def get_db() -> Iterator[Session]:
    if _SessionLocal is None:
        init_engine()
    with _SessionLocal() as db:  # type: ignore[misc]
        yield db


# ------------------------------------------------------------------ auth / RBAC
ROLES = {"admin", "coordinator", "designer", "viewer", "patient"}
_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Principal:
    sub: str
    establishment_id: uuid.UUID
    roles: frozenset[str]
    email: str = ""
    patient_id: uuid.UUID | None = None  # renseigné uniquement pour le rôle patient
    name: str = ""
    authorized_establishments: tuple[uuid.UUID, ...] = ()
    delegate_id: uuid.UUID | None = None


@lru_cache
def _jwks_client(issuer: str):
    return jwt.PyJWKClient(f"{issuer}/protocol/openid-connect/certs")


PORTAL_ISSUER = "carepilot-portal"


def _decode(token: str, s: Settings) -> dict:
    alg = jwt.get_unverified_header(token).get("alg")
    if alg == "HS256":
        # Session patient émise par /portal/session (lien sécurisé). Jamais acceptée comme rôle personnel.
        try:
            claims = jwt.decode(token, s.patient_session_secret, algorithms=["HS256"], audience=s.oidc_audience, issuer=PORTAL_ISSUER)
            claims["realm_access"] = {"roles": ["patient"]}
            return claims
        except jwt.InvalidTokenError:
            if s.auth_mode != "test":
                raise
    if s.auth_mode == "test":
        return jwt.decode(token, s.jwt_test_secret, algorithms=["HS256"], audience=s.oidc_audience)
    key = _jwks_client(s.oidc_issuer).get_signing_key_from_jwt(token).key
    return jwt.decode(token, key, algorithms=["RS256"], audience=s.oidc_audience, issuer=s.oidc_issuer)


def current_principal(request: Request, cred: HTTPAuthorizationCredentials | None = Depends(_bearer), db: Session = Depends(get_db)) -> Principal:
    if cred is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentification requise")
    try:
        claims = _decode(cred.credentials, get_settings())
        est = uuid.UUID(claims["establishment_id"])
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Jeton invalide")
    roles = frozenset(claims.get("realm_access", {}).get("roles", [])) & ROLES
    pid = uuid.UUID(claims["patient_id"]) if claims.get("patient_id") else None
    from app import models as m
    from sqlalchemy import select
    allowed = {est}
    if "patient" not in roles:
        for value in claims.get("establishment_ids", []):
            try: allowed.add(uuid.UUID(value))
            except (ValueError, TypeError): pass
        selected = request.headers.get("X-Establishment-ID")
        if selected:
            try: chosen = uuid.UUID(selected)
            except ValueError: raise HTTPException(403, "Établissement non autorisé")
            if chosen not in allowed: raise HTTPException(403, "Établissement non autorisé")
            est = chosen
        member = db.scalar(select(m.TeamMember).where(m.TeamMember.establishment_id==est,m.TeamMember.subject==claims["sub"]))
        if member:
            if not member.active: raise HTTPException(403, "Accès à l’établissement suspendu")
            ceilings={"admin":{"admin","coordinator","designer","viewer"},"coordinator":{"coordinator","viewer"},"designer":{"designer","viewer"},"viewer":{"viewer"}}
            permitted=set().union(*(ceilings.get(r,set()) for r in roles))
            roles=frozenset({member.role}) if member.role in permitted else frozenset()
    delegate_id = uuid.UUID(claims["delegate_id"]) if claims.get("delegate_id") else None
    if delegate_id:
        grant=db.get(m.CompanionGrant,delegate_id)
        now=dt.datetime.now(dt.timezone.utc)
        if not grant or grant.revoked or grant.patient_id!=pid or grant.establishment_id!=est or grant.expires_at.replace(tzinfo=dt.timezone.utc)<now:
            raise HTTPException(401,"Accès accompagnant expiré ou révoqué")
        path=request.url.path
        permitted=(request.method=="GET" and path in ("/api/portal/me","/api/operations/portal/overview","/api/live/revision")) or (request.method=="POST" and ((path.startswith("/api/portal/tasks/") and path.endswith(("/upload","/submit"))) or path in ("/api/operations/portal/messages","/api/operations/portal/support")))
        if not permitted: raise HTTPException(403,"Action réservée au patient")
    return Principal(claims["sub"], est, roles, claims.get("email", ""), pid, claims.get("name", ""),tuple(sorted(allowed,key=str)),delegate_id)


def require_roles(*allowed: str):
    def dep(p: Principal = Depends(current_principal)) -> Principal:
        if not (p.roles & set(allowed)):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Rôle insuffisant")
        return p

    return dep
