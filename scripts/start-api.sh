#!/bin/sh
# Démarrage de l'API : migration, seed de démo (idempotent), puis serveur sur $PORT.
set -e
cd /srv/apps/api
alembic upgrade head
python seed.py
python -m app.catalogue
cd /srv
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips="*"
