# M3aya Santé | معايا

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/brand/logo-dark.svg" />
  <img src="apps/web/public/brand/logo-light.svg" alt="M3aya Santé | معايا" width="220" />
</picture>

**Your care journey. Our support.**

[Notre vision — français](docs/vision.fr.md) · [Brand assets](apps/web/public/brand/README.md)

## Our vision

**To make M3aya Santé the reference platform for patient-journey coordination in Morocco, placing people, simplicity and artificial intelligence at the heart of every step.**

*معايا* (“with me” in Moroccan Darija) expresses our conviction: no patient should have to navigate the administrative complexity of care alone.

### The problem we solve

Care journeys are often fragmented across patients, healthcare facilities, professionals and insurers. Missing documents, poorly coordinated appointments, manual reminders and limited visibility cause delays, administrative workload and a poorer patient experience.

### Our solution

**M3aya Santé is an intelligent patient-coordination and support platform**, designed for Moroccan clinics, hospitals and healthcare facilities. It combines process automation, AI agents and human oversight to:

- **Support patients** before, during and after care through a bilingual French/Arabic portal.
- **Automate administrative tasks:** document collection, checks, reminders and deadline tracking.
- **Assist clinical and administrative teams** by identifying incomplete files, drafting communications and proposing next actions.
- **Centralize information** to provide an up-to-date view of each patient journey.
- **Support traceability and data protection**, with an approach adapted to Morocco’s regulatory context.

### One platform, nine care pathways

Our ambition covers medical consultation, medical imaging, endoscopy, ambulatory surgery, planned hospitalization, maternity, day hospital, rehabilitation and unplanned admission. Each pathway can have its own steps, documents, follow-up rules and communications within a shared platform. The current administrative reference templates are detailed below.

### Our approach to AI

**AI supports. Professionals stay in control.**

Our AI agents are designed to help teams with administrative work, anticipate bottlenecks and facilitate patient communication. They replace neither clinical judgment nor healthcare professionals’ decisions.

### Our ambition

Build a digital infrastructure that progressively connects patients, healthcare facilities and administrative partners around a continuous, personalized and coordinated journey.

**Less paperwork. Less waiting. More time for care.**

This vision describes the product’s direction. The demonstration limits below describe what is available today.

## Public website

The public landing page is available at `/` (French) and `/?lang=ar` (Arabic, RTL), without a login or patient API requests. The authenticated staff workspace starts at `/app`; existing patient invitation links and deep links continue to work.

The page includes real screenshots with synthetic data, the nine pathway references, an interactive four-step walkthrough, an illustrative human approval panel, security/privacy notices, and a FAQ. Its demo-request form prepares an email to **yassine.aqejjaj@gmail.com** in the visitor’s email application; it does not submit data to a server or send email automatically. No patient data should be included.

![Public website](docs/screenshots/19a-landing-hero.png)

Validation: four public landing scenarios plus authentication and cockpit regression checks passed against production (six browser tests).

Landing typography: Manrope Variable and IBM Plex Sans Arabic, bundled locally under the SIL Open Font License 1.1. Reduced-motion preferences, keyboard navigation and mobile/RTL layouts are supported. Performance and accessibility targets remain goals, not certified scores.

## Try the current application

[Product walkthrough](https://github.com/user-attachments/assets/f6f8542e-7ebe-4b5e-8892-dd34fc8fe758)

M3aya Santé (formerly CarePilot) gives clinic teams one place to coordinate nine administrative pathways, from specialist consultation to maternity and hospitalization: collect paperwork, see overdue tasks, prepare reminders, and keep an audit trail of human approvals.

**[Discover M3aya Santé](https://carepilot-maroc.vercel.app)** · **[Open the application](https://carepilot-maroc.vercel.app/app)** · [Architecture](docs/architecture.md) · [Moroccan regulatory review](docs/compliance-morocco.md) · [Security](docs/security.md)

> **Synthetic data only.** The public deployment is a demonstration. SMS, WhatsApp and email delivery are simulated; OpenAI is not configured. Do not enter real patient data. The application is not certified by the CNDP and does not make medical decisions. Online passwords are generated separately and are never committed here.

![Operations dashboard](docs/screenshots/01-cockpit.png)

## Nine clinic reference pathways

![M3aya Santé pathway catalogue](docs/screenshots/17-catalogue-m3aya.png)

**M3aya Santé — معايا** is the new working product name. *M3aya* means “with me” in Moroccan Darija: coordination that stays alongside each patient. The technical repository, identity realm and existing deployment URLs retain `carepilot` to preserve access. This is a working identity, not a trademark-clearance claim.

Open **Catalogue de parcours** in the sidebar to filter by clinical activity, explore administrative milestones and required reference documents, simulate the template, customize it in the designer, or open a dedicated fictional example. New dossier creation now explicitly selects a published pathway. CSV imports may specify a catalogue key in the `pathway` column.

| Catalogue key | Reference pathway | Reference window | Coordination focus |
|---|---|---|---|
| `consultation` | Specialist consultation | D−7 → D+2 | Appointment, identity, coverage, reception and administrative follow-up |
| `imagerie` | Medical imaging | D−7 → D+2 | Provided prescription, identity, coverage and appointment reception |
| `endoscopie` | Outpatient endoscopy | D−14 → D+3 | Administrative admission, coverage and service contacts |
| `ambulatoire` | Ambulatory surgery | D−21 → D+7 | Existing reference pathway, documents and human-approved reminders |
| `hospitalisation` | Planned hospitalization | D−21 → D+14 | Preadmission, coverage, administrative accommodation preferences and discharge paperwork |
| `maternite` | Maternity admission and stay | D−30 → D+21 | Maternal administrative record, coverage, family contacts and paperwork |
| `hopital_jour` | Scheduled day-hospital visit | D−14 → D+7 | One medically scheduled visit and its coverage; no treatment scheduling |
| `reeducation` | Rehabilitation intake | D−7 → D+14 | Provided prescription, appointment availability and reimbursement documents |
| `admission_non_programmee` | Unplanned admission | D0 → D+7 | Deferred paperwork; administrative collection does not gate urgent care |

![Maternity reference pathway](docs/screenshots/18-maternity-pathway.png)

Dates and documents are **configurable administrative references**, not universal requirements or medical protocols. Predicted admissions and discharge-related dates must be adapted to actual events. No medication, fasting, examination preparation, diagnosis or clinical eligibility is generated. For day-hospital and rehabilitation pathways, care schedules are provided by the clinical team; automatic recurring clinical scheduling is not implemented.

Demo startup installs missing reference templates additively; existing template versions and patient journeys stay unchanged. Outside demo mode, installing a reference creates a draft for a clinic designer to review and publish. Fictional examples are only available in demo mode and are reused rather than duplicated on repeated clicks.

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

The patient portal is bilingual; the staff interface is currently French. **Team management** remains a placeholder page; the pathway catalogue is functional. User administration uses Keycloak.

## Interactive product experience (v0.3)

Start with **Guided demo** in the staff sidebar. It creates one new fictional patient, Amal, without resetting existing records. Deposit a generated insurance certificate in the phone preview, inspect the local reading and confirm the human validation. The dossier moves from 80% to 100% complete.

![Guided patient and coordinator demo](docs/screenshots/13-guided-demo.png)

- **Local document reading:** Tesseract (French/Arabic/English) reads images; Poppler extracts embedded PDF text or renders the first two pages. Suggested type, labelled fields and explicitly labelled expiry dates are returned for review. Reports are encrypted at rest. No document is sent to OpenAI and no identity field or task status is silently changed.
- **Action copilot:** type “Prépare les relances des dossiers incomplets opérés cette semaine” or use the next-seven-days example. Inspect the affected dossiers and draft text, then confirm preparation. Drafts still require human approval in the validation queue before delivery. Plans expire after 15 minutes, are idempotent, and skip changed dossiers or those already awaiting a reminder.
- **Live dossier updates:** authenticated revision polling every three seconds refreshes active staff and patient views. Open the same dossier on two clients to watch validation appear without reloading. This is short polling, not a push/WebSocket guarantee.
- **Explainable blockers:** each dossier shows overdue or submitted tasks, why they need attention, responsibility and the next permitted action. This does not predict cancellations or decide clinical eligibility.
- **Journey simulator:** click **Tester ce parcours** in the designer. Play, pause or scrub through the current template, including unsaved stages; choose an on-time or missing-document scenario. Simulation does not write records or send messages.
- **French / Darija patient assistant:** open **Messages** in the patient portal. Answers quote the clinic's approved procedure cards, with source and version. Unsupported or medical questions can be passed to the team; the encrypted request appears in **Communications**. Administrators publish procedure cards under **Procédures patient**. Demo cards are visibly labelled as demo references.
- **Voice input:** microphone capture is limited to 30 seconds. `faster-whisper` transcribes on the server CPU using an included multilingual tiny model; audio files are then removed. Patients must review and send the editable transcription themselves. Playback uses an installed local browser voice when available. Darija accuracy still requires native-speaker evaluation; transcription can be inaccurate and is never treated as an instruction to send a message.

![Action copilot preview](docs/screenshots/15-copilot.png)
![Journey simulation](docs/screenshots/14-simulator.png)
<img src="docs/screenshots/16-darija-assistant.png" width="320" alt="Patient assistant answering in Darija with a procedure source">

The assistant currently uses deterministic retrieval of approved procedure cards, not unrestricted generative conversation. The copilot supports reminder preparation for the documented date ranges; unsupported requests do not execute actions. Both work without an OpenAI key. Local speech recognition is an open-source transcription component; OpenAI remains the sole provider for the application's external LLM generation and embeddings.

### Extra validation and setup

**Verified online:** all six new browser scenarios passed on the Vercel/Railway deployment, including actual synthetic microphone capture, server-local transcription, editable review, PDF reading, human validation, live refresh, action-plan preparation and patient handoff. All 14 pre-existing online journeys were retained; tests add separate fictional dossiers.

`pytest` includes scope, encryption, no-automatic-validation, stale-plan, duplicate-plan, procedure-version, handoff and simulation-isolation tests. `e2e/wow.spec.ts` adds browser scenarios without resetting the demo. Microphone testing uses a generated fictional English recording; this verifies capture/transcription/review, not Darija accuracy.

The Docker API image includes Tesseract, Poppler, FFmpeg and the speech model; its first build downloads public model weights. For a host-run API, install the system OCR/audio tools and set `VOICE_MODEL_PATH` to a local compatible faster-whisper model directory. If unavailable, document review stays manual and dictation is disabled with an explanation. `DEMO_MODE=true` is required for guided scenarios. Existing dossiers are retained by the additive `0002` migration.

```bash
# Test new screens without resetting existing demo data
(cd apps/web && npx playwright test e2e/wow.spec.ts)
# Verify OCR and audio with entirely synthetic inputs inside the Docker image
docker build -f Dockerfile.api -t carepilot-wow:test .
docker run --rm -v "$PWD/scripts/verify-local-engines.py:/verify.py:ro" carepilot-wow:test python /verify.py
```

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

Open [localhost:5173](http://localhost:5173) for the public website or [the application](http://localhost:5173/app) to sign in.

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

The **3 new catalogue Playwright scenarios also passed against production**, covering the nine templates, a reusable maternity example, and explicit imaging template selection.

Validation: **54 pytest tests passed** locally, including real pgvector retrieval; **10 original Playwright scenarios passed locally and against the live Vercel/Railway deployment** on 28 October 2026. They cover tenant isolation, patient consent, link lockout, encrypted files, invalid uploads, rights/erasure, retention, CSV simulation/import and human approval. The browser tests mutate synthetic data. `scripts/test-deployed.mjs` runs against the online demo using the owner's ignored credentials file; do not run it against a clinic environment.

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

M3aya Santé includes technical mechanisms to support those obligations, but a clinic still needs to establish its lawful basis, complete applicable CNDP formalities, review foreign hosting and provider transfers, and contract with processors. Retention periods must be chosen for the clinic's actual obligations. Railway reports the current API, identity and database region as **SFO (United States)**. This deployment is for synthetic demonstrations only; it is not a Morocco-resident hosting arrangement. Foreign processing must be reviewed before real patient use.

The Moroccan focus does not establish a blanket exemption from GDPR or the EU AI Act where their territorial scope otherwise applies. Legal applicability should be checked for the actual clinic, patients and service arrangement. See the [detailed Moroccan review](docs/compliance-morocco.md), including unresolved questions. No legal compliance, HDS equivalence or qualified electronic-signature claim is made.

## Remaining work before use with real patients

- Obtain applicable CNDP approvals and validate transfers, hosting, processor contracts and Arabic legal copy.
- Add malware scanning, backup/restore exercises, secret rotation, a security assessment and robust patient authentication.
- Move Keycloak to persistent PostgreSQL; run scheduled jobs and monitoring; implement proper incremental migrations.
- Complete team management, hospital-system integration, insurer connections and qualified signatures if required.
- Activate and verify messaging with approved senders/templates; evaluate AI on synthetic cases before enabling it.
- Improve concurrent delivery/idempotency and retention coverage across derived records and backups.

The repository also includes [CI checks](.github/workflows/ci.yml) for API tests and the frontend build, plus a [responsible disclosure policy](.github/SECURITY.md).

## Licenses

The codebase currently has **no project license**; do not assume redistribution rights. Components use their own licenses (including MIT, Apache-2.0, PostgreSQL License and Grafana OSS AGPL-3.0); fonts use SIL OFL. Re-audit exact deployed versions and obligations before distribution. See [architecture notes](docs/architecture.md).
