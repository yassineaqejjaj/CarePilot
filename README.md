# CarePilot (MVP technique)

Coordination administrative du parcours patient — chirurgie ambulatoire J-21 → J+7. Données fictives uniquement.
Docs : [architecture](docs/architecture.md) · [sécurité](docs/security.md).

## Démarrer
```bash
cp .env.example .env            # renseigner OPENAI_* pour l'IA réelle
podman compose up --build       # postgres+pgvector, rabbitmq, keycloak, api, worker, caddy, prometheus, grafana
cd apps/web && npm install && npm run dev
```
Tests (sans réseau, OpenAI mocké) :
```bash
uv venv --python 3.12 .venv && source .venv/bin/activate && uv pip install -e ".[dev]" && pytest
```

## État d'avancement (honnête)
| Élément | État |
|---|---|
| Architecture, modèle de données, sécurité | fait (docs/) |
| API : établissements, patients fictifs, parcours versionnés, tâches, cockpit, audit, analytics | fait, 18 tests verts (SQLite) |
| OpenAIProvider, MockProvider, RAG, 4 agents, validation humaine, coûts | fait, testé avec faux client/mock |
| PostgreSQL+pgvector, Keycloak (realm importé), login PKCE | **validés** avec Docker (Podman absent de cette machine) |
| Caddy, Prometheus, Grafana, SeaweedFS, RabbitMQ/Celery, services `api`/`worker` du Compose | écrits, **non démarrés** |
| Migration Alembic | **exécutée sur PostgreSQL 16 + pgvector 0.8.7** ; recherche cosinus testée (`tests/test_pgvector.py`) |
| Frontend | Cockpit, Journey Designer (React Flow + édition/versionnement), portail patient, Analytics (Recharts), login Keycloak PKCE ; Tailwind + composants shadcn-style. vérifié dans un navigateur (cockpit, designer, analytics) et par Playwright ; la vue patient n'a été vue que via les tests, pas à l'écran |
| Portail patient : dépôt de fichiers | non fait (SeaweedFS non branché) ; le patient confirme l'envoi, un coordinateur valide |
| Playwright (5 scénarios) | fait, voir ci-dessous. Tests de sécurité automatisés hors isolation/RBAC : à faire |
| Appels OpenAI réels | jamais exécutés (aucune clé) |

## Comptes de démonstration Keycloak
`staff.demo` / `patient.demo` (mot de passe `demo-only`, dev uniquement). Les attributs `establishment_id` et `patient_id`
doivent correspondre à des lignes réelles : créez l'établissement et un patient fictif, puis mettez leurs UUID dans le realm
(ou dans la console Keycloak). Le realm contient un `patient_id` factice à remplacer.

## Reproduire la validation (ports décalés si 5432/8080/8000 sont pris)
```bash
POSTGRES_PORT=5442 KEYCLOAK_PORT=8081 docker compose -p carepilot up -d postgres keycloak
export DATABASE_URL=postgresql+psycopg://carepilot:carepilot@localhost:5442/carepilot OIDC_ISSUER=http://localhost:8081/realms/carepilot
(cd apps/api && PYTHONPATH=../..:. alembic upgrade head && PYTHONPATH=../..:. python seed.py)
PYTHONPATH=.:apps/api uvicorn app.main:app --port 8010 &
(cd apps/web && VITE_API_TARGET=http://localhost:8010 VITE_KEYCLOAK_URL=http://localhost:8081 npx vite &)
PG_TEST_URL=$DATABASE_URL pytest                 # 19 tests dont pgvector réel
(cd apps/web && npm run e2e)                     # Playwright, utilise Google Chrome installé
```
Les E2E modifient la base de démo (une pièce soumise par exécution, un brouillon de parcours par exécution).
Pour repartir de zéro : `docker compose -p carepilot down -v` puis relancer migration + seed.
