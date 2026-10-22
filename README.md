# CarePilot

**Administrative patient-journey coordination for  private clinics.**
*Every patient. Every step. Connected.*

CarePilot helps a clinic's admissions team keep every patient's pre- and post-operation paperwork on track, from **D-21 to D+7** around an ambulatory surgery. It shows who needs attention today, drafts the reminders for you, and never sends anything without a human saying yes.

> **Demo only.** All patients, clinics and documents in this repository are **fictitious**. CarePilot is **not** presented as GDPR- or HDS-compliant, and it must not process real health data before the legal, contractual and security review described in [Security & compliance](#security--compliance). It coordinates **administrative** tasks only: no diagnosis, no medical decision.

![Operations cockpit](docs/screenshots/01-cockpit.png)

---

## Contents

- [For users](#for-users): what it does, screen by screen
- [Quick start](#quick-start)
- [For developers](#for-developers): architecture, AI layer, API, data model, tests
- [Security & compliance](#security--compliance)
- [Status & limitations](#status--limitations)

---

# For users

## Who uses it

| Role | What they can do |
|---|---|
| **Coordinator** (admissions team) | Work the priority queue, review documents, validate or reject what the AI prepared |
| **Designer** | Build and version patient-journey templates |
| **Admin** | Everything above, plus approve knowledge-base documents and see AI usage and cost |
| **Viewer** | Read-only access to the dashboards |
| **Patient** | A mobile space limited to *their own* journey: upload documents, follow progress |

Each clinic only ever sees its own data.

## The screens

### 1. Operations cockpit: "what needs me today?"

![Operations cockpit, full page](docs/screenshots/01b-cockpit-full.png)

The home page opens with a daily summary: active journeys, how many are on track, incomplete files, tasks to handle (with the urgent ones counted), deadlines within 72 hours, and journeys completed this week.

- **Priority queue**, ranked by deadline and impact on the surgery date. Each card shows the patient, the procedure, the missing document, the owner and a one-click action.
- **CarePilot Assistant** (dark panel): recommendations such as "5 patients have not answered for more than 72 h". Anything the AI prepared is clearly marked *Human validation required*.
- A filterable table of all journeys below (on track, action required, waiting for patient, late, completed).

### 2. Journey detail: the whole story of one patient

![Journey detail](docs/screenshots/02-journey-detail.png)

- **Next administrative action**: a suggestion prepared by CarePilot (dashed mint border = AI-prepared, not yet validated). You read the exact message, then **Reject**, **Edit** or **Approve & send**.
- **Timeline** from D-21 to D+7 with owner and due date on every step; the current step is highlighted.
- **Expected documents** with their status (*Validated*, *Under review*, *Missing*) and a **recent activity** feed that says who did what: team, patient or automation.

### 3. Validation queue: nothing leaves without you

![Validation queue](docs/screenshots/03-validation-queue.png)

Every message draft and every administrative check prepared by the AI waits here. Approving or rejecting is recorded in the audit log with your name.

> In this demo, "Approve & send" **validates** the proposal but the SMS / e-mail delivery is **simulated**. No real message is ever sent. The "Edit" button is not implemented yet.

### 4. Journey designer: build the care path once

![Journey designer](docs/screenshots/04-journey-designer.png)

A visual editor for the journey template (the first one ships ready: *Ambulatory surgery D-21 → D+7*, 15 steps, 5 required documents). Published journeys are **immutable**: to change one you create a new version, edit it, and publish it. Patients already in the journey keep the version they started with.

### 5. Analytics

![Analytics](docs/screenshots/05-analytics.png)

Completeness rate, average completion delay, reminders sent, an *estimate* of time saved, and (for admins) token usage and estimated cost per AI agent.

### 6. The patient's mobile space

<img src="docs/screenshots/06-patient-mobile.png" alt="Patient mobile space" width="320">

A calm, large-type space: one clear thing to do first, a progress bar, the list of tasks with their status, key dates, and the admissions desk contact. A permanent reminder says it is for administrative matters only and points to the surgeon for medical questions (and to 15 in an emergency).

## How the AI helps (and where it stops)

Four specialised agents, each with a narrow scope:

| Agent | Does | Never does |
|---|---|---|
| **Administrative verification** | Finds missing documents, flags anomalies | Decide that a file is valid |
| **Communication** | Drafts reminders from *approved templates* and procedures | Send anything on its own |
| **Follow-up** | Classifies a patient's reply, lists what remains, proposes allowed next actions | Change a status |
| **Summary** | Summarises administrative interactions for the coordinator | Give medical information |

Rules that hold everywhere: the AI only *proposes*; a named human validates; no direct patient identifier is sent to the model; the whole AI layer can be switched off globally or per clinic.

---

# Quick start

You need **Docker** (or Podman) with Compose, **Python 3.11+**, and **Node 18+**.

```bash
git clone https://github.com/yassineaqejjaj/carepilot.git && cd carepilot
cp .env.example .env

# 1. Postgres (with pgvector) and Keycloak (auth), with the realm pre-imported
docker compose up -d postgres keycloak          # `podman compose` works too

# 2. API: migrate, load the fictitious demo data, run
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt pytest
(cd apps/api && PYTHONPATH=../..:. alembic upgrade head && PYTHONPATH=../..:. python seed.py)
PYTHONPATH=.:apps/api uvicorn app.main:app --port 8000

# 3. Web app (in another terminal)
cd apps/web && npm install && npm run dev       # http://localhost:5173
```

Open <http://localhost:5173> and sign in with a **development-only** demo account:

| Account | Password | Lands on |
|---|---|---|
| `staff.demo` (Claire Dubois, coordinator/designer/admin) | `demo-only` | Back-office |
| `patient.demo` (Sophie Martin) | `demo-only` | Mobile patient space |

**Port conflicts?** Override with `POSTGRES_PORT=5442 KEYCLOAK_PORT=8081 docker compose up -d postgres keycloak`, then point the API at it (`DATABASE_URL`, `OIDC_ISSUER`) and the web app at Keycloak (`VITE_KEYCLOAK_URL`, plus `VITE_API_TARGET` if the API is not on :8000).

**Reset the demo data:** `RESET=1 python seed.py` (from `apps/api`).

**AI features:** without an `OPENAI_API_KEY` the app runs fully; the proposals you see are seeded demo data. To use real generation, set the `OPENAI_*` variables below. Only synthetic data should ever be used.

---

# For developers

## Architecture

A **modular monolith**: one FastAPI service, one Celery worker, one React SPA, and an AI layer (`ai/`) that has **no import from the application code**.

```mermaid
flowchart LR
  WEB[React SPA] --> API[FastAPI]
  WEB -. OIDC + PKCE .-> KC[Keycloak]
  API -- JWT / JWKS --> KC
  API --> PG[(PostgreSQL + pgvector)]
  API --> MQ[(RabbitMQ)] --> WRK[Celery worker] --> PG
  API --> AG[ai/ agents] --> PROV[OpenAIProvider]
  AG --> RAG[RAG service] --> PROV
  RAG --> PG
  PROV --> OAI[(OpenAI API)]
```

### Repository layout

```
apps/
  api/        FastAPI app (app/), Alembic migrations, demo seed
  web/        React + TypeScript + Vite SPA, Playwright e2e tests
  worker/     Celery worker (overdue-task scan; skeleton)
ai/
  providers/  OpenAIProvider (the only code that calls OpenAI) + MockProvider
  agents/     the four agents
  rag/        chunking, embeddings, vector-store protocol
  guardrails/ identifier redaction, medical-advice filter
  prompts/    system prompts
infrastructure/  Keycloak realm + image, Caddy, Prometheus
scripts/      start-api.sh, make-deploy-realm.py
tests/        pytest suite
docs/         architecture.md, security.md, screenshots/
```

### Tech stack (open source, except the LLM)

| Layer | Choice |
|---|---|
| Web | React 18, TypeScript, Vite, Tailwind CSS (design tokens from the design board), shadcn-style components, TanStack Query, React Hook Form + Zod, React Flow (designer), Recharts (analytics), Inter |
| API | Python 3.12, FastAPI, Pydantic, SQLAlchemy 2, Alembic, REST / OpenAPI (`/docs`) |
| Data | PostgreSQL 16 + pgvector, RabbitMQ + Celery |
| Auth | Keycloak (OIDC authorization code + PKCE), RBAC from realm roles, tenant from a token claim |
| AI | OpenAI Python SDK: Responses API (structured outputs validated by Pydantic) and Embeddings API |
| Ops | Docker/Podman Compose, Caddy, Prometheus (`/metrics`), Grafana |
| Tests | pytest, Playwright |

### Multi-tenancy and RBAC

Every business table carries `establishment_id`. The establishment comes from the **access-token claim**, never from a request parameter, and every query is scoped to it (`services.get_scoped`). Cross-clinic access returns **404**, not 403, so it reveals nothing. Roles (`admin`, `coordinator`, `designer`, `viewer`, `patient`) come from Keycloak realm roles; patients are additionally bound to a `patient_id` claim and can only reach `/api/portal/*`.

### Data model (core)

`establishment` → `patient`, `journey_template` → `template_step`; `patient_journey` (a versioned instance of a template) → `task` (due date = surgery date + step offset); `audit_log`; `knowledge_document` → `knowledge_chunk` (pgvector embedding); `ai_usage` (tokens and cost per call); `ai_proposal` (what an agent prepared, awaiting a human).

See [docs/architecture.md](docs/architecture.md) for the ER diagram.

### The AI layer

- **One door to OpenAI.** `OpenAIProvider` handles calls, timeouts and retries (SDK-level), a **monthly token budget per clinic**, **cost estimation** (prices come from env, never hard-coded), structured output validation, and **metadata-only logging** (clinic, agent, model, token counts: never a prompt or a response). Calls use `store=False`.
- **Guardrails before sending.** E-mail, phone and French NIR are redacted from free text; if a direct identifier remains the call is refused. The patient's first name is substituted **locally after** the model answers, so it never leaves the server.
- **Agents propose, humans dispose.** Agents return typed results which become `ai_proposal` rows (`pending`). Approval/rejection is audited. Agents have no write access to journey or task status. Missing documents are computed **deterministically in code**, not by the model.
- **RAG.** Approved procedure documents → chunks (~800 chars) → embeddings → pgvector (cosine `<=>`). Retrieval is filtered by establishment **and** `status = 'approved'`. No patient data is embedded.
- **Kill switches.** `AI_ENABLED` (global) and `establishment.ai_enabled`.
- **Testable offline.** `MockProvider` returns canned structured outputs and deterministic embeddings; the whole suite runs without network or API key.

### Configuration

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLAlchemy URL (`postgresql+psycopg://…`) |
| `OIDC_ISSUER`, `OIDC_AUDIENCE` | Keycloak realm URL and expected `aud` (`carepilot-api`) |
| `AUTH_MODE` | `oidc` (default). `test` (HS256 tokens) is refused outside `ENV=dev/test` |
| `AI_ENABLED` | Global AI kill switch |
| `OPENAI_API_KEY`, `OPENAI_LLM_MODEL`, `OPENAI_EMBEDDING_MODEL` | Model names are **not** hard-coded |
| `OPENAI_TIMEOUT_SECONDS`, `OPENAI_MAX_RETRIES` | Defaults 30 / 3 |
| `OPENAI_PRICE_IN_PER_1M_EUR`, `OPENAI_PRICE_OUT_PER_1M_EUR` | Used for cost tracking; cost is only meaningful once set |
| `EMBEDDING_DIM` | Must match the embedding model and the `vector(N)` column (1536) |
| `VITE_KEYCLOAK_URL/REALM/CLIENT` | Public web-app settings (never put a secret in `VITE_*`) |

No API key ever reaches the browser.

### API at a glance

All routes are under `/api`; interactive docs at `/docs`.

| Area | Routes |
|---|---|
| Overview | `GET /cockpit`, `GET /journeys`, `GET /journeys/{id}/detail`, `GET /analytics`, `GET /audit`, `GET /me` |
| Journeys | `POST /patients`, `POST /journeys`, `GET /journeys/{id}/tasks`, `POST /tasks/{id}/complete` |
| Templates | `GET /templates`, `PUT /templates/{id}/steps` (drafts only), `POST /templates/{id}/new-version`, `POST /templates/{id}/publish` |
| AI | `POST /ai/documents` (+ `/approve`), `POST /ai/verify/{journey}`, `POST /ai/communicate`, `POST /ai/followup`, `POST /ai/summary/{journey}`, `GET /ai/proposals`, `POST /ai/proposals/{id}/approve` or `/reject`, `GET /ai/usage` |
| Patient portal | `GET /portal/me`, `POST /portal/tasks/{id}/submit` |

Operational: `GET /healthz`, `GET /metrics` (Prometheus).

### Testing

```bash
pytest                                                    # 18 tests, no network, SQLite (1 more with PG_TEST_URL)
PG_TEST_URL=postgresql+psycopg://carepilot:carepilot@localhost:5432/carepilot pytest   # + real pgvector ranking
cd apps/web && npm run e2e                                # 7 Playwright scenarios (needs the full stack running + Google Chrome)
```

- **API** (`tests/test_api.py`): journey generation and due dates, cockpit priorities, **tenant isolation**, RBAC, template versioning/immutability, patient-portal scoping.
- **AI** (`tests/test_ai.py`): redaction, provider cost/budget/guardrails with a fake OpenAI client, RAG filtered by clinic and approval, agent behaviour, kill switch, usage tracking.
- **pgvector** (`tests/test_pgvector.py`): cosine ranking, draft exclusion and clinic isolation on a real PostgreSQL.
- **E2E** (`apps/web/e2e`): Keycloak redirect, cockpit, journey detail, human validation, designer immutability, mobile patient space (incl. no horizontal scroll).

The E2E tests mutate the demo data (a document submitted, a draft version created); reset with `RESET=1 python seed.py`.

### Deployment

`Dockerfile.api` builds the API image (its entrypoint `scripts/start-api.sh` migrates, seeds the demo data idempotently, then serves on `$PORT`). `infrastructure/keycloak/Dockerfile` builds a demo Keycloak image, and `scripts/make-deploy-realm.py` generates a realm with **random passwords** and the frontend's redirect URIs (the output stays out of git). The Keycloak image uses `start-dev`, which is fine for a demo but not for production. A hosted deployment is **not live yet**.

---

# Security & compliance

CarePilot is built to *support* a compliant setup; it is **not** certified or compliant by itself.

**In place**

- Fictitious data only; patients carry a pseudonymous `ref` that is what the AI sees.
- Tenant isolation and RBAC enforced server-side and covered by tests; patient accounts are confined to their own journey.
- Redaction and refusal of direct identifiers before any OpenAI call; first names substituted locally; `store=False`; metadata-only logs.
- Human validation for every AI proposal; every sensitive action in the audit log.
- Global and per-clinic AI kill switch; per-clinic token budget and cost tracking.
- No secret in the frontend; the test auth mode cannot run in production.

**Known limits**

- Regex redaction does **not** catch names in free text. Treat patient free text sent to the Follow-up agent as a risk until the flow is reviewed.
- No application-level column encryption, no automated retention/purge, no rate limiting, no dependency scanning in CI yet.
- The patient "upload" in the demo records a confirmation; file storage (SeaweedFS) is not wired.

**Before any real health data is processed through OpenAI** you need, at minimum: a data-protection impact assessment and legal basis under GDPR; a data-processing agreement with OpenAI covering location and international transfers; **HDS-certified hosting** for health data and a check that the flows to OpenAI are compatible with it; and a security review / penetration test. See [docs/security.md](docs/security.md).

**OpenAI cost and limits.** One structured generation = one Responses call. Loading a procedure = one embeddings call per batch of chunks, and each RAG-assisted agent run adds one query embedding. Measure on synthetic data through `GET /api/ai/usage` before setting a budget.

**Licenses.** Components are open source (React, Vite, TanStack, React Hook Form, Zod, React Flow, Recharts, shadcn/ui, FastAPI, Pydantic, SQLAlchemy, Alembic, Celery: MIT/BSD; PostgreSQL and pgvector: PostgreSQL license; Keycloak, Caddy, Prometheus, SeaweedFS, Playwright: Apache-2.0; RabbitMQ: MPL-2.0; Inter: SIL OFL). **Grafana OSS is AGPL-3.0**, so have legal review it. Re-check versions when you pin them. This repository does not yet declare its own license.

---

# Status & limitations

| Area | State |
|---|---|
| Back-office (cockpit, journeys, detail, validation, designer, analytics) | Working, verified in a browser and by e2e tests |
| Patient mobile space | Working (document "upload" is a confirmation, no file transfer) |
| AI layer (provider, RAG, four agents, validation, cost tracking) | Implemented and tested with mocks and a fake client; **never run against the real OpenAI API** |
| Postgres + pgvector, Keycloak realm, migrations | Verified locally with Docker |
| Compose `api`, `worker`, Caddy, Prometheus, Grafana, SeaweedFS, RabbitMQ | Written, **not started or tested** |
| Sidebar pages *Tasks, Communications, Reports, Team, Journey models, Settings* | Placeholders ("coming soon") |
| "New journey" / "Export" buttons | Not wired in the UI (journey creation exists in the API) |
| Hosted deployment | Not live yet |

Design source: the *CarePilot Design System v1.0* board (tokens, components, three reference screens).
