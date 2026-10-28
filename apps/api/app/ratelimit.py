"""Limitation de débit en mémoire (fenêtre glissante) + en-têtes de sécurité.

Suffisant pour une instance unique ; derrière plusieurs instances, remplacer par un compteur partagé (Redis).
"""
from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import Request
from fastapi.responses import JSONResponse

from app.core import get_settings

LIMITS = [("/api/operations/companion/session", 10), ("/api/portal/session", 10), ("/api/portal/", 120), ("/api/", 600)]  # (préfixe, requêtes par minute et par IP)
_hits: dict[tuple[str, str], deque] = defaultdict(deque)


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    return (fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "?"))


async def security_middleware(request: Request, call_next):
    s = get_settings()
    path = request.url.path
    if s.rate_limit_enabled and s.env != "test":
        now, ip = time.monotonic(), _client_ip(request)
        for prefix, limit in LIMITS:
            if path.startswith(prefix):
                q = _hits[(ip, prefix)]
                while q and now - q[0] > 60:
                    q.popleft()
                if len(q) >= limit:
                    return JSONResponse({"detail": "Trop de requêtes, réessayez dans une minute"}, status_code=429, headers={"Retry-After": "60"})
                q.append(now)
                break
    resp = await call_next(request)
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Referrer-Policy"] = "no-referrer"
    if path.startswith("/api/"):
        resp.headers["Cache-Control"] = "no-store"
    return resp
