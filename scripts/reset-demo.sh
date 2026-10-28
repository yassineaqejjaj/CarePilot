#!/bin/bash
# Remet les données fictives de démonstration à zéro (avant les tests e2e). Nécessite DATABASE_URL et un Python avec les dépendances.
set -e
cd "$(dirname "$0")/../apps/api"
RESET=1 PYTHONPATH=../..:. "${PYTHON:-python}" seed.py
