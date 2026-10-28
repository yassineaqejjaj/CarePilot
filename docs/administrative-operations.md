# Administrative operations, version 0.5

M3aya coordinates paperwork and human follow-up. It does not diagnose, triage, choose treatment, interpret prescriptions, establish medical eligibility or cancel/refuse care automatically.

## Staff workflow

Open **Centre de préparation** from the sidebar or the dashboard. Each row exposes the next administrative action, responsible service, deadline and the reason for follow-up. Patient help requests, contact corrections, unread replies, received documents and insurance requests are actionable in the same queue.

Open a dossier to:

1. Assign or hand off responsibility to an active team member, record exceptions (no smartphone, unreadable document, unanswered insurer, changed date, contact issue), and track administrative phase. Marking a dossier complete requires its blocking paperwork to be validated; arrival itself remains possible with missing paperwork.
2. Prepare a coverage request and track a human-confirmed response: draft → submitted → additional information / approved / rejected. A stale revision is rejected rather than overwriting another person's changes. External insurance decisions and medical justifications are not generated or transmitted by this module.
3. Record verified financial facts in MAD: quote, coverage, externally received deposit and externally performed refund. Amounts are integer centimes. Coverage cannot exceed the quote, refunds cannot exceed net deposits, and corrections append reversal entries instead of rewriting history. This is an administrative ledger and estimate, not a payment processor, tax invoice engine or coverage guarantee.
4. Send a human-approved administrative template, inspect provider acceptance/delivery/failure, read patient portal replies, or record a manual contact. Acknowledging a provider request is distinct from confirmed delivery.
5. Resolve help requests, review patient contact changes before applying them, record encrypted internal transmissions, and shift unfinished administrative deadlines when the establishment supplies a new anchor date. Completed tasks retain their dates.

## Teams and sites

Team management restricts existing Keycloak accounts by establishment. Members have a display name, role, service, availability and optional active backup. Administrators can suspend access; every API request checks the roster. Roster roles cannot exceed the roles granted by the identity provider. Account/password creation stays in Keycloak; no password is exposed by this UI. The authenticated coordinator/admin can register their own existing identity through the rollout checklist.

The network view lists only the primary establishment and extra IDs in the verified OIDC `establishment_ids` claim. `X-Establishment-ID` selects among those authorized IDs, never grants access. Configure claims in the identity provider; the application cannot grant itself additional sites. Patient and companion sessions remain bound to their own establishment. There are no invented extra clinics in the public demo.

## Patient experience

The bilingual portal keeps a single next task and shows received / under review / validated status. A request to replace a document includes the staff-entered reason. A native preview lets patients check a photo or chosen file before transmission; a low-resolution warning is advisory, never a medical/document validity decision. Patients can optionally reduce an image on their device for a slow connection and inspect it again before transmission; no external image service is used.

Patients can request help, send administrative replies, inspect an estimate if staff entered one, and submit new contact preferences for human review. They can immediately stop optional administrative reminders without closing their dossier. A contact change is not applied silently.

A patient can authorize a companion for 72 hours. A separate link and six-digit code open a short session. Only token/code hashes are stored; five incorrect codes lock the invitation. The patient can revoke access and the next API request is rejected, including for an existing companion session. Companions may transmit documents and administrative messages; they cannot consent for the patient, export the patient's data, change contacts, create delegations or exercise personal rights. Financial information/contact fields are not returned by the companion overview. Share the link and code separately.

## Drafts and identity reuse

New-journey drafts are encrypted server-side, scoped to author and establishment, and saved with a revision check. Closing the dialog waits for a save; reopening resumes the current draft, with the information checkbox reset for confirmation. A conflict asks the user to reload rather than overwriting another session. The retention job removes drafts older than 30 days.

Duplicate suggestions use normalized name and optional birth date inside the current establishment. Staff may reuse a verified existing identity when creating a new journey. No automatic merge changes patient access or destroys existing records.

## Pilot measurement

The measurement tab accepts observed task durations, grouped by administrative activity and baseline/pilot cohort. It displays sample sizes and differences of observed averages. Empty cohorts produce no invented gain; there is no causal attribution, automatic annual extrapolation or promised ROI. The network screen compares authorized sites. The legacy analytics estimate remains explicitly labelled as an estimate and links to these observations.

## Security and deployment

Migration `0003` adds thirteen tables and does not reset existing patients/templates. Comments, replies, insurance notes and drafts are encrypted using the existing Fernet key. Audit records contain action metadata rather than message bodies. Patient data exports include the new stored administrative content; anonymization scrubs message/note content, contact-related drafts, insurance/financial references and revokes companion access.

Live revision polling includes the new workflow state and remains tenant/patient scoped. Keycloak itself is not redeployed for this release. Real health-data use still requires the existing legal, contractual, hosting and operational review.

See [Brevo setup](brevo.md) and [Moroccan software discovery](integrations-morocco.md) for external dependencies and integration limits.

## Deliberate external boundaries

Keycloak identity provisioning is performed by the existing identity administration; the application roster attaches/restricts existing identities and never creates a password. Site access comes only from trusted identity claims. Insurance statuses and financial receipts are recorded after human verification; no insurer decision API or payment processor has been guessed. The current generic HIS exchange is executable; named vendor connectors require each vendor's authorized contract and sandbox. Brevo is ready to configure, with documented WhatsApp/template and inbound-threading limits. Real provider delivery cannot be tested without credentials and approved test recipients.
