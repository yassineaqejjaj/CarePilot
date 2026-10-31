# M3aya Santé | معايا

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/brand/logo-dark.svg" />
  <img src="apps/web/public/brand/logo-light.svg" alt="M3aya Santé | معايا" width="220" />
</picture>

**Your care journey. Our support.**

[![CI](https://github.com/yassineaqejjaj/CarePilot/actions/workflows/ci.yml/badge.svg)](https://github.com/yassineaqejjaj/CarePilot/actions/workflows/ci.yml)

## At a glance

| | |
|---|---|
| **Name** | The product is called **M3aya Santé**; the repository is named **CarePilot** (the application text also says "formerly CarePilot"). |
| **What it is** | A patient-journey coordination and support platform for Moroccan clinics, with a bilingual French/Arabic patient portal, nine administrative care pathways and human-approved AI assistance. |
| **Problem** | Care journeys are fragmented across patients, facilities, professionals and insurers: missing documents, poorly coordinated appointments and manual reminders ([details](#the-problem-we-solve)). |
| **Status** | **Prototype**: a demonstration with synthetic data only, not for real patients (see [Remaining work before use with real patients](#remaining-work-before-use-with-real-patients)). |
| **Demo** | [Live demo](https://carepilot-maroc.vercel.app) · [Product walkthrough](https://github.com/user-attachments/assets/f6f8542e-7ebe-4b5e-8892-dd34fc8fe758) |
| **Architecture** | [`docs/architecture.md`](docs/architecture.md) and [Architecture and stack](#architecture-and-stack) |
| **Security and compliance** | [`docs/security.md`](docs/security.md) · [`docs/compliance-morocco.md`](docs/compliance-morocco.md) |
| **Case study** | [How this project was built](https://github.com/yassineaqejjaj/agentic-sdlc/blob/main/docs/case-studies/carepilot.md) |

**Where to find what**: product overview, problem and solution ([Our vision](#our-vision)) · key features ([For clinic teams](#for-clinic-teams)) · architecture and tech stack ([For developers](#architecture-and-stack)) · screenshots and demo ([Try the current application](#try-the-current-application)) · getting started ([Run locally](#run-locally)) · testing and quality ([Tests](#tests)) · known limitations ([Remaining work before use with real patients](#remaining-work-before-use-with-real-patients)) · licence ([Licenses](#licenses): no project licence file yet). Roadmap: not yet documented as a separate section; open items are listed under remaining work.

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

### Reproducible frontend publication

The Vercel project must use **root directory `apps/web`**, framework **Vite**, build command **`npm run build`**, install command **`npm ci`**, and output directory **`dist`**. These settings are configured for the connected GitHub project, and the public `VITE_KEYCLOAK_URL` is set in the production environment. Building from the monorepo root can publish no frontend files and overwrite a working deployment.

An explicit [Vercel Build Output API](https://vercel.com/docs/build-output-api) static package is also available as a reproducible publication/recovery path. This checks the generated entry assets and preserves the API proxy, security headers and SPA deep links independently of framework output discovery.

```sh
cd apps/web
VITE_KEYCLOAK_URL=https://keycloak-production-a68c.up.railway.app npm run build
cd ../..
python scripts/package-web-output.py
cd apps/web
npx vercel deploy --prebuilt --prod
```

The packager reads the backend destination from `apps/web/vercel.json` and copies only the generated public `dist` files into ignored `.vercel/output`. It never reads provider keys or patient records. After publication, verify `/`, `/app`, `/operations`, a static asset and an authenticated API call; a deployment marked Ready alone is not sufficient validation.

## Replayable animated onboarding

Open **Aide → Visite guidée**, use **Visite guidée** in the staff header, or visit `/visite-guidee`. A dismissible first-use invitation offers the same entry point. The tour remains available after completion or dismissal, including through **Plus** on mobile.

Follow Amal’s fictional ambulatory-surgery journey through **13 steps, from J−21 to J+7**: overview, pathway selection, dossier creation, team assignment, invitation, patient portal, document receipt, human review, insurance/administrative amounts, approved reminders, arrival, administrative closure and pilot results.

- Animated illustrative scenes, direct step selection, **Précédent / Suivant**, optional eight-second autoplay, pause, Escape to pause, restart and exit.
- Progress is saved locally per signed-in identity and tour version. Returning starts at the introduction with a **Reprendre** option; browser storage failures do not prevent the tour. Progress is a browser preference, not a training certification or an account-wide record.
- Reduced-motion preferences disable the scene animations and autoplay; all content remains available through manual navigation. Mobile uses horizontally scrollable step selection and accessible bottom controls.
- **The tour creates no dossier, uploads no file, sends no message and calls no AI provider.** All names, documents, statuses and amounts inside the tour are illustrative. Normal authenticated shell read requests still occur.
- The existing **Démo guidée** is separate: its explicitly launched scenario creates a fictional dossier and demonstrates real sample upload and human validation. The animated tour explains this distinction before linking to it.

![Animated patient-journey tour](docs/screenshots/30-onboarding-desktop.png)

<img src="docs/screenshots/31-onboarding-mobile.png" alt="Mobile onboarding with manual navigation and reduced-motion support" width="300" />

Implementation: lazy-loaded `apps/web/src/pages/Onboarding.tsx`, scoped `onboarding.css`, a small first-use invitation and versioned local progress metadata. No new dependency or database migration. The frontend build and **16 local browser checks** passed, including all 13 steps without API mutations, replay/resume, pause, dismissal, mobile/reduced-motion behavior, and navigation/UX regressions.

## Faster daily work — UX update

The interface now helps a coordinator move from an actionable queue to the right part of a dossier, with fewer intermediate steps.

| Improvement | Available behavior |
|---|---|
| Focused dashboard | Three primary indicators: tasks due today or overdue, active dossiers with unvalidated document steps, and task deadlines from today through three days ahead. Secondary establishment metrics are expandable. Calendar-day windows are not represented as exact rolling 72-hour measurements. |
| Clear counter units | Work-queue tabs count distinct dossiers, while summary cards count received pieces or insurance requests. One dossier can belong to several tabs. The scope explanation is available under **Comprendre les compteurs**. Search and date filters affect the list; counters follow the personal/presentation scope. |
| Contextual actions | **Vérifier les pièces**, **Lire la réponse**, **Suivre l’assurance**, **Répondre à la demande** and **Vérifier les coordonnées** lead directly to the relevant dossier section. |
| Dedicated dossier sections | Insurance, finance, communications, help, coordination and history have separate visible views. Patient context and section navigation remain available; keyboard focus stays within the panel and closing restores background scrolling. |
| Useful work views | Personal/unassigned dossiers, tomorrow’s scheduled admissions, pending insurance, name search, date windows and sorting by deadline/patient/owner. Active filter chips and **Effacer les filtres** make the current selection explicit. |
| Saved filters | Save up to five local workflow views per identity/selected site. Only scope, work category, action/date filters and sort choice are stored: patient-name searches are never saved in a view. Browser storage can be unavailable without preventing core work. |
| Configurable reading | **Affichage** offers comfortable/compact table density, an icon sidebar with accessible labels, and an optional demo filter for technical test names. The dossier table also remembers optional stage/progress/owner columns. |
| Mobile workspace | A fixed bottom dock, dossier cards instead of wide desktop tables, horizontally scrollable work categories, collapsible filters, and accessible section navigation. Mobile controls have a 44 px minimum height; administrative form actions stay reachable inside their panel. |
| Consistent language | **Nouveau dossier** creates an individual patient dossier; pathway templates remain in **Bibliothèque de parcours**. General-purpose lists use **Prise en charge**, and priority labels explain administrative follow-up rather than implying medical triage. |
| Presentation without deletion | The optional **Masquer les tests techniques (démo)** preference filters obvious technical names from lists. Existing records, underlying establishment metrics and authorization rules are retained. Screenshots use this presentation preference where useful. |

![Focused operational overview](docs/screenshots/01-cockpit.png)

<img src="docs/screenshots/29-worklist-mobile.png" alt="Mobile worklist with bottom navigation and actionable dossier cards" width="300" />

### Implementation and validation

Shared display preferences are implemented in `apps/web/src/lib/display.tsx`; workflow filters remain in the operations page and column preferences in the dossier table. Settings contain UI metadata only. They are local to the browser, not a cross-device account configuration. No migration, patient-data reset, messaging-provider change or new dependency is required for this update. The frosted-material accessibility fallbacks remain active.

For this UX update, **29 local browser scenarios passed** across the application, catalogue, operations, navigation and UX suites; the production frontend build also passed. **11 read-only browser checks passed against the deployed application**, covering navigation and the new UX workflows without changing patient dossiers. Browser scenarios in `apps/web/e2e/ux.spec.ts` cover filter persistence without patient-search storage, direct document actions, independent insurance/finance views, display preferences, optional columns, the mobile dock and dashboard hierarchy. Run browser tests directly, without the demo-reset script:

```sh
cd apps/web
npx playwright test e2e/ux.spec.ts e2e/navigation.spec.ts e2e/operations.spec.ts
```

### Clinic usability validation to conduct

Automated checks do not replace observation in a clinic. With a receptionist, coordinator and manager, test three tasks: find a dossier, review a submitted piece, and identify the next administrative blocker. Record completion time, errors, requests for assistance and participant comments. Compare the same tasks before and after changes; no user-study results or measured productivity gains are claimed here.

## Frosted interface materials

The staff workspace and patient portal use a restrained glassmorphism treatment: a static mint/blue backdrop, translucent cards and navigation, fine highlight borders and soft depth. Dialogs and administrative side panels use a denser material; nested cards, data tables and form fields retain stable reading surfaces. Status colors remain unchanged.

Materials are shared in `apps/web/src/index.css` (`glass-card`, `glass-toolbar`, `glass-sidebar`, `glass-sheet`, `glass-control`). Browsers without backdrop-filter receive opaque fallbacks. Reduced-transparency and increased-contrast preferences remove the effect, Windows forced colors are respected, and print styles remove blur and shadows. No animation or new UI dependency is introduced.

## Navigation designed around clinic work

The staff menu now separates everyday work, pathway configuration, pilot measurement and administration. Existing bookmarks remain usable.

| Group | Entries | Who sees it |
|---|---|---|
| **Au quotidien** | Vue d’ensemble, À traiter, Dossiers patients, Communications | Staff |
| **Parcours & automatisations** | Bibliothèque de parcours, Concepteur, Automatisations, Procédures administratives | Staff; designer/admin rights required for Concepteur |
| **Pilotage** | Résultats du pilote, Rapports, Établissements | Staff; Établissements appears only with multiple authorized facilities |
| **Administration** | Équipe & accès, Intégrations, Paramètres | Administrators |
| **Aide** | Démo guidée | Staff |

**Start with À traiter:** document review, insurance follow-up, patient replies, help/contact requests and pending human approvals have their own filters. Counters come from current dossiers; the sidebar counts actionable dossiers assigned to the current user or unassigned (all actionable dossiers for administrators), rather than all active patients. Coordinators start here automatically and can expand their view to the entire authorized establishment. All tasks and deadlines remain available from this screen.

**Open a dossier:** Résumé, Documents, Assurance, Finances, Communications and Historique keep the same patient context. Insurance, finance and communication actions open an independent section in the administrative side panel. Unrelated forms stay hidden; their in-progress values are preserved when switching sections. The contextual assistant button opens the dossier’s existing blockers and human-reviewed proposals; it does not introduce an autonomous action or send patient details to a new AI service.

**Automatisations** combines agent monitoring and the action copilot. **Résultats du pilote** starts with observed baseline/pilot measurements and links separately to activity statistics and estimates. Pilot setup remains under Paramètres. `/app` opens the overview for administrators and other staff, or À traiter for coordinators. These navigation choices supplement backend authorization; hiding a menu never grants or revokes API permissions.

**On mobile:** a fixed bottom dock provides Accueil · À traiter · Dossiers · Messages · Plus. The Plus panel exposes the remaining authorized destinations and closes after selection. Patient and companion portals retain their separate navigation.

![Staff navigation and actionable worklist](docs/screenshots/27-navigation-desktop.png)

<img src="docs/screenshots/28-navigation-mobile.png" alt="Mobile navigation with the Plus panel open" width="300" />

### Routes and compatibility

| Destination | Route | Existing links retained |
|---|---|---|
| Overview | `/vue-ensemble` | `/app` resolves according to role |
| Work queue | `/operations` | `/validation` opens the human approval tab; `/taches` remains available |
| Pathway library | `/modeles` | Unchanged |
| Automations | `/automatisations` | `/agents`; `/copilote` opens the copilot tab |
| Pilot results | `/resultats` | `/analyses` remains the activity/estimate view; `/operations?onglet=mesures` still works |
| Team, integrations, facilities | `/equipe`, `/integrations`, `/etablissements` | Legacy `/operations?onglet=equipe`, `integrations`, `reseau` remain usable within existing permissions |

Navigation browser tests cover desktop grouping, mobile Plus, URL/back-button filters, legacy aliases, contextual dossier sections and coordinator navigation. They use synthetic data without resetting the demonstration.

## Administrative operations — release 0.5

**[Open À traiter](https://carepilot-maroc.vercel.app/operations)**

The new center turns a dossier into an actionable workflow: who should act next, what is missing and which deadline to follow. It covers preparation, human handoffs and exception handling without making a medical decision.

| Capability | Available behavior | Explicit boundary |
|---|---|---|
| Preparation center | Queue of received documents, help requests, replies, contact corrections and coverage requests | Administrative priorities only; urgent care is never gated by paperwork |
| Insurance tracking | Prepare, transmit-status tracking, request complements and record a verified decision, with revision conflicts detected | No insurer API submission, medical justification or generated approval |
| Team coordination | Existing-account roster, service/role, availability, active backups, reassignment and access suspension | Account/password provisioning stays in Keycloak; app permissions cannot exceed identity grants |
| Financial administration | Verified quotes, coverage, external deposits/refunds and estimated balance in MAD; immutable correction entries | No card processing, tax-invoice engine or guarantee of reimbursement |
| Patient preadmission | Photo/file preview, received/reviewed/replacement states, help and replies, contact review and reminder opt-out | Staff validates documents and requested contact corrections |
| Companion access | Patient-authorized 72 h access with separate link/code, attempt limit and immediate revocation | No patient-rights export, contact/consent changes, financial detail or delegation chaining |
| Drafts and duplicates | Encrypted per-author drafts, resume/save-conflict handling, scoped possible-duplicate suggestions and explicit identity reuse | No automatic record merging or sharing of patient sessions |
| Pilot measurement | Baseline/pilot observations by activity, sample sizes, observed averages and authorized-site comparison | No invented time savings or causal ROI claim |
| Interoperability | CSV preview/import/export; revocable server-side connection keys and idempotent admission/status API | Vendor-specific connectors need a verified contract and sandbox |
| Brevo transport | Server-side email/SMS and approved-template WhatsApp adapter, authenticated delivery callback, human approval and manual fallback | Public demo remains simulated; keys, senders and templates are not configured here |

![Preparation center](docs/screenshots/25-preparation-center.png)

![Administrative dossier](docs/screenshots/26-administrative-case.png)

**External setup:** the public deployment still sends no real messages and uses fictional patients. Configure the owner's Brevo account before transport tests; never put provider keys in frontend variables. See [Brevo configuration and limits](docs/brevo.md). Patient replies work through the portal; external inbound email/SMS threading and WhatsApp delivery mapping are not presented as validated.

The network screen shows only establishments explicitly authorized by verified identity claims. It does not fabricate a clinic group or allow an administrator to grant themselves another clinic's data. The rollout checklist collects admissions contacts and communication hours; completing it is not regulatory approval for real patient data.

See [administrative workflows, security and retention](docs/administrative-operations.md) and [Moroccan HIS discovery and API contract](docs/integrations-morocco.md). MASAHA, MagicaHIS, Mibtech and FireHIS are research candidates based on vendor-published sources, with no partnership or certified compatibility claimed.

## A familiar, bilingual sign-in experience

The Keycloak login page now follows the M3aya Santé design system: a compact supplied logo, navy/teal palette, Manrope and IBM Plex Sans Arabic, French/Arabic switching and RTL layout. Desktop pairs a journey illustration with the form; mobile prioritizes sign-in. Password-manager autocomplete, password visibility, native errors, keyboard navigation and the existing OIDC/PKCE flow are retained. The landing page carries the selected language through to sign-in.

![French sign-in](docs/screenshots/22-authentication-fr.png)

<details><summary>Arabic and mobile previews</summary>

![Arabic sign-in](docs/screenshots/23-authentication-ar.png)

<img src="docs/screenshots/24-authentication-mobile.png" alt="Mobile sign-in" width="300" />

</details>

**Validation:** eight production browser checks passed across the theme, language handoff, staff cockpit and patient access. The existing demo accounts and passwords are unchanged. See [authentication theme, installation and rollback](docs/authentication.md) for the implementation and deployment limitations. The layout follows contemporary web patterns and accessibility practices; no future-year standard or accessibility certification is claimed.

## Nine clinic reference pathways

![M3aya Santé pathway catalogue](docs/screenshots/17-catalogue-m3aya.png)

**M3aya Santé — معايا** is the new working product name. *M3aya* means “with me” in Moroccan Darija: coordination that stays alongside each patient. The technical repository, identity realm and existing deployment URLs retain `carepilot` to preserve access. This is a working identity, not a trademark-clearance claim.

Open **Bibliothèque de parcours** in the sidebar to filter by clinical activity, explore administrative milestones and required reference documents, simulate the template, customize it in the designer, or open a dedicated fictional example. New dossier creation now explicitly selects a published pathway. CSV imports may specify a catalogue key in the `pathway` column.

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

1. Start in **À traiter** for the next administrative action, or open **Vue d’ensemble** for the wider operational picture.
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

See intervention details, coordinator, dated milestones, expected documents, recent activity and the next proposal awaiting approval. The **Envoyer le lien patient** button creates a time-limited invitation.

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

The patient portal is bilingual; the staff interface is currently French. Team/service management, availability and backups are functional. Identity/password provisioning remains in Keycloak; the app roster restricts existing accounts. The pathway catalogue is functional.

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

Validation: **70 pytest tests passed** locally, including real pgvector retrieval. **18 browser scenarios passed locally** for the historical application, public website and new administrative workflows; the authentication/catalogue regression suite also passed. **13 release checks passed against the live Vercel/Railway deployment**, including insurance/financial preparation, limited companion access and the bilingual website/sign-in. All runs use synthetic data only. They cover tenant isolation, patient consent, link lockout, encrypted files, invalid uploads, rights/erasure, retention, CSV simulation/import and human approval. The browser tests mutate synthetic data. `scripts/test-deployed.mjs` runs against the online demo using the owner's ignored credentials file; do not run it against a clinic environment.

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
- Validate vendor-specific HIS and insurer contracts in a sandbox; generic administrative exchange is available. Identity account provisioning remains in Keycloak. Payment processing and qualified signatures are separate integrations.
- Activate and verify messaging with approved senders/templates; evaluate AI on synthetic cases before enabling it.
- Improve concurrent delivery/idempotency and retention coverage across derived records and backups.

The repository also includes [CI checks](.github/workflows/ci.yml) for API tests and the frontend build, plus a [responsible disclosure policy](.github/SECURITY.md).

## Licenses

The codebase currently has **no project license**; do not assume redistribution rights. Components use their own licenses (including MIT, Apache-2.0, PostgreSQL License and Grafana OSS AGPL-3.0); fonts use SIL OFL. Re-audit exact deployed versions and obligations before distribution. See [architecture notes](docs/architecture.md).

---

## Part of an engineering approach

Built with the [Agentic SDLC framework](https://github.com/yassineaqejjaj/agentic-sdlc) (earned autonomy). Read how this project was built and what its checks caught in the [case study](https://github.com/yassineaqejjaj/agentic-sdlc/blob/main/docs/case-studies/carepilot.md).

Companion to the book [Leading with AI: A Blueprint for AI-Enhanced Healthcare](https://www.amazon.fr/dp/B0CVB848M6).
