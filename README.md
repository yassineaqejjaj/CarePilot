# CarePilot Morocco

**Administrative patient-journey coordination for Moroccan private clinics.**  
*Every patient. Every step. Connected.*

CarePilot gives an admissions team one place to prepare ambulatory surgery from **D−21 to D+7**: collect paperwork, see overdue tasks, prepare reminders, and keep an audit trail of human approvals.

**[Open the live demo](https://carepilot-maroc.vercel.app)** · [Architecture](docs/architecture.md) · [Moroccan regulatory review](docs/compliance-morocco.md) · [Security](docs/security.md)

> **Synthetic data only.** The public deployment is a demonstration. SMS, WhatsApp and email delivery are simulated; OpenAI is not configured. Do not enter real patient data. The application is not certified by the CNDP and does not make medical decisions. Online passwords are generated separately and are never committed here.

![Operations dashboard](docs/screenshots/01-cockpit.png)

## For clinic teams

### Your daily workflow

1. Open the **Operations cockpit** to see urgent dossiers, missing paperwork and upcoming deadlines.
2. Create a patient journey manually, or import a **CSV** of scheduled procedures. Phone numbers are normalized to **+212**; dates accept **DD/MM/YYYY**.
3. Send a patient an access link. They confirm their date of birth, read the privacy notice, then use a mobile portal in **French or Arabic**, including right-to-left layout.
4. Review uploaded documents and mark them validated or request a replacement.
5. Read, edit and approve reminder drafts. Each approval and delivery attempt is recorded. The public demo records simulated delivery.
6. Export journeys or audit history, monitor progress, and handle patient rights requests.

The default administrative pathway requests a **CIN or passport**, **AMO certificate (CNSS / CNOPS)**, admission questionnaire, insurance approval and signed administrative consent. No live CNSS, CNOPS or insurer integration is implemented.

### Dashboard

The priority queue ranks journeys by deadline and missing blocking documents. Counts come from actual demo records; they are not copied from the design board.

![Full operations dashboard](docs/screenshots/01b-cockpit-full.png)

### Patient journey detail

See intervention details, coordinator, dated milestones, expected documents, recent activity and the next proposal awaiting approval. The **Send patient link** button creates a time-limited invitation.

![Patient journey detail](docs/screenshots/02-journey-detail.png)

### Human review and communications

Messages can be edited before approval. Rules prepare missing-document reminders without calling a language model. A communications journal distinguishes **sent**, **simulated** and **failed** deliveries; contact details are masked.

![Validation queue](docs/screenshots/03-validation-queue.png)

### Journey designer and analytics

Published templates are immutable. Create a new draft version, edit its stages and publish it; existing journeys keep their original version. Analytics shows completion, delays and reminders. **Time saved is a configurable estimate, not a measured ROI claim.**

![Journey designer](docs/screenshots/04-journey-designer.png)
![Analytics](docs/screenshots/05-analytics.png)

### Mobile patient portal — French and Arabic

Patients use a private link and date-of-birth check, or a demo Keycloak account. A versioned privacy notice is shown before their journey. They can upload PDF, JPEG, PNG or HEIC documents, answer administrative tasks, download a data export and submit a rights request. Staff verify submissions.

<table><tr><td><img src="docs/screenshots/06-patient-mobile.png" width="280" alt="French patient portal"></td><td><img src="docs/screenshots/08-patient-arabic.png" width="280" alt="Arabic patient portal with right-to-left layout"></td></tr></table>

<details><summary>Privacy notice and secure entry screen</summary>

<img src="docs/screenshots/12-patient-entry.png" width="280" alt="Patient link date-of-birth verification">
<img src="docs/screenshots/07-patient-consent.png" width="280" alt="Versioned privacy notice and consent">

</details>

### Create journeys, import and configure

CSV import supports comma or semicolon separators, a dry run, row-level errors and up to 500 records. Required columns: `first_name`, `last_name`, `surgery_date`. Optional: `birth_date`, `phone`, `email`, `procedure`, `surgeon`, `owner`, `language` (`fr`/`ar`), `channel` (`whatsapp`/`sms`/`email`).

![New journey form](docs/screenshots/11-new-journey.png)

Administrators configure the clinic's CNDP references, rights contact and retention period. Retention processing anonymizes eligible closed dossiers. A demo-only reset is available when `DEMO_MODE=true`.

![Compliance settings](docs/screenshots/10-compliance-settings.png)

### Roles

| Role | Scope |
|---|---|
| Coordinator | Journeys, tasks, document review, invitations, message approval, rights requests |
| Designer | Journey template creation and versioning |
| Admin | Coordinator and designer functions, settings, audit export, erasure |
| Viewer | Read-only staff views |
| Patient | Their own portal only |

The patient portal is bilingual; the staff interface is currently French. **Team management** and **template catalogue** remain placeholder pages. User administration uses Keycloak.

## Run locally

Requirements: **Python 3.12**, **Node.js 20+**, Docker Compose or Podman Compose. The repository is private.

```bash
git clone https://github.com/yassineaqejjaj/carepilot.git
cd carepilot
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt pytest

# Separate ports avoid conflicts with other projects.
POSTGRES_PORT=5442 KEYCLOAK_PORT=8081 docker compose -p carepilot up -d postgres keycloak
# Wait until PostgreSQL and http://localhost:8081/realms/carepilot are ready.
export DATABASE_URL=postgresql+psycopg://carepilot:carepilot@localhost:5442/carepilot
export OIDC_ISSUER=http://localhost:8081/realms/carepilot
export PUBLIC_WEB_URL=http://localhost:5173
(cd apps/api && PYTHONPATH=../..:. alembic upgrade head && PYTHONPATH=../..:. python seed.py)
PYTHONPATH=.:apps/api uvicorn app.main:app --port 8010
```

In a second terminal:

```bash
cd carepilot/apps/web
npm ci
VITE_KEYCLOAK_URL=http://localhost:8081 VITE_API_TARGET=http://localhost:8010 npm run dev
```

Open [localhost:5173](http://localhost:5173).

| Development account | Development password | View |
|---|---|---|
| `staff.demo` — Salma El Idrissi | `demo-only` | Clinic team |
| `patient.demo` — Khadija Alaoui | `demo-only` | Patient portal |

These passwords apply **only locally**. The live deployment uses generated passwords supplied privately to the owner.

To reset synthetic records: activate the virtual environment, set `DATABASE_URL`, then run `bash scripts/reset-demo.sh`. **This deletes and recreates demo data.** To stop containers without removing data: `docker compose -p carepilot stop`.

The full Compose file also describes RabbitMQ/Celery, Caddy, Prometheus, Grafana and SeaweedFS. Those services have not all been validated together. The instructions above run the API and Vite on the host. `.env.example` is a configuration reference; its container database hostname is not appropriate for a host-run API.

## For developers

### Architecture and stack

A modular monolith exposes a REST/OpenAPI API. A separate worker runs scheduled rules and retention. All generation and embeddings go through the independent `ai/` layer.

```mermaid
flowchart LR
  Staff[Clinic team] --> Web[React frontend]
  Patient[Patient FR / AR] --> Web
  Web --> KC[Keycloak OIDC + PKCE]
  Web --> API[FastAPI modular monolith]
  API --> DB[(PostgreSQL + pgvector)]
  API --> Files[Encrypted patient documents]
  API --> Msg[SMTP / SMS / WhatsApp adapter]
  API --> AI[Central OpenAIProvider]
  AI --> OAI[OpenAI Responses + Embeddings]
  Worker[Celery scheduled rules] --> DB
```

| Layer | Components |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind, shadcn-style local components, TanStack Query, React Hook Form, Zod, React Flow, Recharts |
| API | Python, FastAPI, Pydantic, SQLAlchemy, Alembic |
| Data | PostgreSQL 16, pgvector; encrypted documents in DB by default, optional local disk |
| Identity | Keycloak for staff; short-lived signed patient sessions for invitation access |
| AI | Official OpenAI Python SDK; Responses, structured Pydantic outputs, embeddings and approved-procedure RAG |
| Jobs | RabbitMQ and Celery; reminder drafts require human approval |
| Tests | pytest, real-pgvector integration, Playwright with installed Google Chrome |

```text
apps/api/         API, Alembic migrations, synthetic seed
apps/web/         Staff and patient UI, Playwright tests
apps/worker/      Reminder and retention jobs
ai/               Central provider, agents, RAG and guardrails
infrastructure/   Keycloak, Caddy and monitoring configuration
scripts/          Deployment helpers and demo reset
tests/            API, authorization, Morocco-specific and pgvector tests
docs/             Architecture, security, CNDP review and screenshots
```

### Security and data handling

- Every protected resource is scoped to the establishment in the authenticated token. Unauthorized cross-clinic resources return 404. Patient tokens cannot access staff routes.
- Invitations store a **token hash**. They expire after 72 hours by default and lock after five incorrect birth-date attempts. The birth-date check is an additional knowledge check, **not strong multifactor authentication**. Patient sessions last 12 hours by default.
- Uploads are size-limited, names are sanitized and file signatures are checked. Bytes are encrypted with **Fernet before storage**. Staff document downloads are audited. **Malware scanning is not implemented.**
- Privacy notices and consent are versioned. Patients can export their data and submit access, rectification, opposition or deletion requests. Admins can anonymize a dossier. Retention rules are configurable; the deployed demo does not yet run the scheduled worker.
- Rate limiting is in memory for one API instance. API responses use `no-store`, `nosniff` and frame restrictions. Secrets stay server-side.

### Controlled AI

Four agents cover administrative verification, communication drafts, follow-up classification and structured summaries. They propose actions; business rules and people authorize changes.

The RAG indexes **approved administrative procedures only**, scoped by establishment and version. Identifiable patient data is not embedded. Guardrails detect email, Moroccan CIN patterns, +212 phone numbers and long social-insurance identifiers. Regex checks cannot reliably detect names or every identifier.

`AI_ENABLED` and the clinic switch can disable AI. Calls are additionally blocked until a CNDP transfer reference is entered. **Entering a reference does not validate its authenticity or make a transfer legally authorized.** The public demo has no OpenAI key. Seeded or rule-generated proposals demonstrate the workflow.

The provider controls timeout/retries, output validation, metadata logging and token budgets; usage and estimated costs are recorded per clinic. Configure current unit prices before relying on costs.

### Configuration

| Variables | Purpose |
|---|---|
| `DATABASE_URL`, `OIDC_ISSUER`, `OIDC_AUDIENCE` | Database and staff authentication |
| `ENV`, `AUTH_MODE` | Runtime mode; test auth is refused outside dev/test |
| `PUBLIC_WEB_URL` | Base URL included in patient invitations |
| `PATIENT_SESSION_SECRET`, `FILE_ENCRYPTION_KEY` | Required outside dev/test; back up the file key separately |
| `PATIENT_SESSION_HOURS`, `INVITATION_HOURS`, `INVITATION_MAX_ATTEMPTS` | Patient access lifetime and lockout |
| `STORAGE_BACKEND`, `STORAGE_DIR`, `MAX_UPLOAD_MB` | Encrypted DB or local storage; default upload limit 10 MB |
| `MESSAGING_PROVIDER` | `console` (simulated) or `live` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Email over SMTP with STARTTLS |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`, `TWILIO_WHATSAPP_FROM` | SMS/WhatsApp adapter; sender/template approval may be required |
| `AI_ENABLED`, `OPENAI_API_KEY`, `OPENAI_LLM_MODEL`, `OPENAI_EMBEDDING_MODEL` | AI switches and model configuration |
| `OPENAI_TIMEOUT_SECONDS`, `OPENAI_MAX_RETRIES`, `OPENAI_PRICE_IN_PER_1M_EUR`, `OPENAI_PRICE_OUT_PER_1M_EUR` | Provider limits and estimated EUR cost, not MAD billing |
| `TIMEZONE` | Defaults to `Africa/Casablanca`, including its timezone changes |
| `DEMO_MODE` | Enables destructive synthetic-data reset; keep false for real operation |
| `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT` | Public frontend configuration; never put secrets in Vite variables |

Messaging adapters exist and are tested with mocked providers. **No live delivery or WhatsApp onboarding has been verified.** SMTP is a protocol; Twilio and deployment hosts are external commercial services, while application dependencies are open source.

### API entry points

Interactive API documentation: `/docs` on the API service. Staff endpoints include `/api/journeys`, `/api/journeys/import`, `/api/journeys/export.csv`, `/api/tasks`, `/api/messages`, `/api/settings`, `/api/data-requests`, `/api/audit/export.csv` and `/api/ai/proposals`. Patient endpoints live under `/api/portal`: session, notice/consent, own journeys, uploads, data export and rights requests.

### Tests

```bash
# From the repository root, with the virtual environment active
pytest -q
PG_TEST_URL=postgresql+psycopg://carepilot:carepilot@localhost:5442/carepilot pytest -q

# Local end-to-end tests (RESET synthetic demo data first)
export DATABASE_URL=postgresql+psycopg://carepilot:carepilot@localhost:5442/carepilot
(cd apps/web && npm run e2e)
```

Validation: **37 pytest tests passed** locally, including real pgvector retrieval; **10 Playwright scenarios passed locally and all 10 also passed against the live Vercel/Railway deployment** on 28 October 2026. They cover tenant isolation, patient consent, link lockout, encrypted files, invalid uploads, rights/erasure, retention, CSV simulation/import and human approval. The browser tests mutate synthetic data. `scripts/test-deployed.mjs` runs against the online demo using the owner's ignored credentials file; do not run it against a clinic environment.

### Deployment

- **Frontend:** [Vercel live demo](https://carepilot-maroc.vercel.app), with `/api/*` forwarded to Railway.
- **API:** Railway Docker service, migrations and synthetic seed at startup; `/healthz` probes process health.
- **Database:** Railway PostgreSQL/pgvector service with a verified attached volume at `/var/lib/postgresql/data`. Backup/restore policy still needs validation before real use.
- **Staff authentication:** Railway Keycloak, optimized production startup. Current demo uses embedded H2; move identity storage to a backed-up PostgreSQL database before operational use.
- **Not deployed:** Celery/RabbitMQ and the monitoring stack. Automated reminders/retention currently require a manual API trigger in the online demo.

The Keycloak realm generation helper creates deployment-specific passwords outside version control. The development realm contains local demo passwords only. Deployment is currently CLI-based, not a validated GitHub auto-deployment pipeline.

**Migration limitation:** the initial Alembic revision currently creates tables from model metadata. Existing databases with an older initial schema require an explicit upgrade migration; recreating a disposable demo database is not an acceptable upgrade strategy for real records.

## Moroccan regulation

Morocco has data-protection obligations under **Law 09-08**. The CNDP publishes a patient-follow-up authorization procedure and requires supporting notice/consent or another legal basis, and processor documentation. See the [CNDP's official procedure](https://www.cndp.ma/procedures-de-notification-process/) and [notification requirements](https://www.cndp.ma/notifier-un-traitement/).

CarePilot includes technical mechanisms to support those obligations, but a clinic still needs to establish its lawful basis, complete applicable CNDP formalities, review foreign hosting and provider transfers, and contract with processors. Retention periods must be chosen for the clinic's actual obligations. Railway reports the current API, identity and database region as **SFO (United States)**. This deployment is for synthetic demonstrations only; it is not a Morocco-resident hosting arrangement. Foreign processing must be reviewed before real patient use.

The Moroccan focus does not establish a blanket exemption from GDPR or the EU AI Act where their territorial scope otherwise applies. Legal applicability should be checked for the actual clinic, patients and service arrangement. See the [detailed Moroccan review](docs/compliance-morocco.md), including unresolved questions. No legal compliance, HDS equivalence or qualified electronic-signature claim is made.

## Remaining work before use with real patients

- Obtain applicable CNDP approvals and validate transfers, hosting, processor contracts and Arabic legal copy.
- Add malware scanning, backup/restore exercises, secret rotation, a security assessment and robust patient authentication.
- Move Keycloak to persistent PostgreSQL; run scheduled jobs and monitoring; implement proper incremental migrations.
- Complete team management and template catalogue, hospital-system integration, insurer connections and qualified signatures if required.
- Activate and verify messaging with approved senders/templates; evaluate AI on synthetic cases before enabling it.
- Improve concurrent delivery/idempotency and retention coverage across derived records and backups.

## Licenses

The codebase currently has **no project license**; do not assume redistribution rights. Components use their own licenses (including MIT, Apache-2.0, PostgreSQL License and Grafana OSS AGPL-3.0); fonts use SIL OFL. Re-audit exact deployed versions and obligations before distribution. See [architecture notes](docs/architecture.md).
