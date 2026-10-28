# Moroccan clinic software: integration discovery

Research date: 28 October 2026. These are vendor-published references, not an independently verified market-share ranking or a claim of partnership with M3aya Santé.

| Vendor/product | Public evidence | Integration implication |
|---|---|---|
| MASAHA / Plénitude Groupe | The vendor describes admission, coverage, billing and multisite workflows and names Polyclinique Alaoui in Meknès and MEDIPOLE among references. | Candidate for administrative admission/status exchange; request API documentation and a sandbox from the pilot clinic and vendor. |
| Magica HealthTech / MagicaHIS | The vendor publishes clinic/group references and describes a multisite HIS, AMO and administrative billing. Its GestiCab FAQ says interfaces/APIs can be arranged. | Investigate the actual product/version installed at the clinic; no public authenticated API contract was validated here. |
| Mibtech | The vendor describes healthcare software deployed in a Moroccan private-clinic network. Its published deployment figures are vendor claims. | Candidate for group-level discussions; obtain the administrative data contract and access rules before development. |
| FireThunder / FireHIS | Moroccan vendor presenting HIS, agenda, governance and billing products. | Additional discovery candidate; deployment at a specific pilot clinic remains to be confirmed. |

Sources: [MASAHA and references](https://www.masaha.ma/), [Magica references](https://www.magicahealthtech.com/references.html), [Magica integration FAQ](https://www.magicahealthtech.com/faq.html), [Mibtech](https://mibtech.ma/), [FireThunder](https://firethunder.ma/).

## What ships now

M3aya implements a vendor-neutral administrative contract, not guessed vendor-specific APIs:

- CSV import with preview, per-row errors and pathway selection; scoped CSV exports.
- Revocable integration keys, created by an establishment administrator and shown once. Only their SHA-256 hashes are stored.
- `POST /api/operations/exchange/admissions`: authenticated with `X-Integration-Key`; `external_id` is unique per connection. Repeated calls return the same journey without creating another patient.
- `GET /api/operations/exchange/status`: only admissions from that connection, exposing reference, administrative phase and administrative completeness. No diagnosis, clinical result or medical decision.
- The key is bound to one establishment. Connections cannot select another tenant or submit an internal patient ID.

Example body (entirely fictional):

```json
{
  "external_id": "PILOT-ADM-001",
  "patient": {
    "first_name": "Patient",
    "last_name": "Fictif",
    "birth_date": "14/03/1986",
    "informed": true,
    "language": "fr"
  },
  "surgery_date": "2026-11-20",
  "procedure": "Admission administrative fictive"
}
```

`surgery_date` is the legacy API name for the pathway's anchor date; it does not select or authorize care. The clinic supplies it. Replaying the same external ID does not silently update clinical or administrative facts: corrections are handled explicitly in the administrative workflow.

Before a vendor-specific connector: confirm the installed software/version, obtain written access authorization and test credentials, map patient identifiers and administrative statuses, define ownership and correction rules, then validate in a sandbox with fictional data. No vendor connector, insurance approval transmission or certification is claimed until that process is completed.
