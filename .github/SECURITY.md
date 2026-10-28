# Security policy

## Supported status

This repository is a **research/MVP project**, not a certified or approved production system. Security, privacy, medical or educational compliance has **not** been established for use with real patients, students or organizations.

All demonstrations and test data must remain **synthetic**. Do not submit live patient records, clinical data, real student details, access tokens, passwords or proprietary client documents.

## Reporting a vulnerability

Please **do not publish exploit steps, credentials or sensitive details in a public issue**.

1. Use GitHub's **Report a vulnerability** / private vulnerability reporting feature under the repository's *Security* tab, **if available**.
2. If it is not available, contact the maintainer through an existing private contact channel listed on their public GitHub profile. Do not assume public GitHub issues are confidential.

A report should contain the affected commit/version, impact, reproducible steps using fictional data, and suggested mitigations. Never include real personal information or active keys.

## Disclosure and usage limits

No guaranteed response or remediation time is promised. A passing CI or evaluation suite does **not** establish clinical safety, GDPR/HDS compliance, educational suitability or production readiness. Independent security reviews, domain expertise and the appropriate legal assessments are required before real-world use.

## Safe development practices

- Keep `.env` files, API keys and seed credentials outside Git history.
- Use synthetic data in screenshots, logs, demos and tests.
- Run dependency/security checks before releases and record the outcomes.
- Restrict deployment access and verify authorization, tenant isolation and retention behavior.
