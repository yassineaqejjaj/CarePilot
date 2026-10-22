"""Configuration, base de données et sécurité (OIDC/RBAC) regroupées."""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from functools import lru_cache
from typing import Iterator

import jwt
from fastapi import Depends, HTTPException, status
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


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.auth_mode == "test" and s.env not in ("dev", "test"):
        raise RuntimeError("AUTH_MODE=test interdit en dehors de dev/test")
    return s


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


@lru_cache
def _jwks_client(issuer: str):
    return jwt.PyJWKClient(f"{issuer}/protocol/openid-connect/certs")


def _decode(token: str, s: Settings) -> dict:
    if s.auth_mode == "test":
        return jwt.decode(token, s.jwt_test_secret, algorithms=["HS256"], audience=s.oidc_audience)
    key = _jwks_client(s.oidc_issuer).get_signing_key_from_jwt(token).key
    return jwt.decode(token, key, algorithms=["RS256"], audience=s.oidc_audience, issuer=s.oidc_issuer)


def current_principal(cred: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> Principal:
    if cred is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentification requise")
    try:
        claims = _decode(cred.credentials, get_settings())
        est = uuid.UUID(claims["establishment_id"])
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Jeton invalide")
    roles = frozenset(claims.get("realm_access", {}).get("roles", [])) & ROLES
    pid = uuid.UUID(claims["patient_id"]) if claims.get("patient_id") else None
    return Principal(claims["sub"], est, roles, claims.get("email", ""), pid, claims.get("name", ""))


def require_roles(*allowed: str):
    def dep(p: Principal = Depends(current_principal)) -> Principal:
        if not (p.roles & set(allowed)):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Rôle insuffisant")
        return p

    return dep
