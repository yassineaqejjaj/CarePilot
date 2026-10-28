#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
export DATABASE_URL=postgresql+psycopg://carepilot:carepilot@localhost:5442/carepilot
export OIDC_ISSUER=http://localhost:8081/realms/carepilot
export PUBLIC_WEB_URL=http://localhost:5173
export ENV=dev DEMO_MODE=true AUTH_MODE=oidc PYTHONPATH=.:apps/api
exec .venv/bin/python -m uvicorn app.main:app --port 8010
