import datetime as dt
import hashlib
import json
import uuid
import pytest
from sqlalchemy import select
from app import models as m, compliance, operations as o, messaging
from app.core import get_settings, today
from tests.test_morocco import make_journey, invite_link


def setup(client, auth, make_est):
    est = make_est()
    h = auth(est)
    jid, _ = make_journey(client, h)
    return est, h, jid


def patient(client, h, jid):
    _, token = invite_link(client, h, jid)
    r = client.post(
        "/api/portal/session", json={"token": token, "birth_date": "14/03/1986"}
    ).json()
    ph = {"Authorization": "Bearer " + r["access_token"]}
    assert (
        client.post(
            "/api/portal/consent", headers=ph, json={"accept": True}
        ).status_code
        == 200
    )
    return ph


def test_case_scope_revision_and_non_clinical_arrival(client, auth, make_est):
    est, h, jid = setup(client, auth, make_est)
    other = auth(make_est("Other"))
    assert client.get("/api/operations/cases/" + jid, headers=other).status_code == 404
    b = {"revision": 0, "phase": "ready"}
    assert (
        client.put("/api/operations/cases/" + jid, headers=h, json=b).status_code == 409
    )
    b["phase"] = "arrived"
    assert (
        client.put("/api/operations/cases/" + jid, headers=h, json=b).status_code == 200
    )
    assert (
        client.put("/api/operations/cases/" + jid, headers=h, json=b).status_code == 409
    )
    assert (
        client.put(
            "/api/operations/cases/" + jid,
            headers=auth(est, roles=("viewer",)),
            json={"revision": 1},
        ).status_code
        == 403
    )
    rows = client.get("/api/operations/worklist", headers=h).json()["items"]
    assert rows[0]["phase"] == "arrived" and rows[0]["missing"] > 0


def test_team_suspension_role_cap_and_own_access(client, auth, make_est):
    est = make_est()
    h = auth(est)
    b = {"subject": "staff2", "display_name": "Agent", "role": "viewer"}
    assert client.put("/api/operations/team", headers=h, json=b).status_code == 200
    assert (
        client.post(
            "/api/patients",
            headers=auth(est, roles=("coordinator",), sub="staff2"),
            json={},
        ).status_code
        == 403
    )
    b["active"] = False
    client.put("/api/operations/team", headers=h, json=b)
    assert (
        client.get(
            "/api/operations/worklist", headers=auth(est, sub="staff2")
        ).status_code
        == 403
    )
    assert (
        client.put(
            "/api/operations/team",
            headers=h,
            json={"subject": "user-1", "display_name": "Me", "role": "viewer"},
        ).status_code
        == 409
    )
    assert (
        client.put(
            "/api/operations/team", headers=auth(est, roles=("coordinator",)), json=b
        ).status_code
        == 403
    )


def test_insurance_lifecycle_and_stale_edits(client, auth, make_est):
    _, h, jid = setup(client, auth, make_est)
    r = client.post(
        "/api/operations/cases/" + jid + "/insurance",
        headers=h,
        json={"insurer": "CNSS", "note": "Pièces administratives à vérifier"},
    )
    assert r.status_code == 201
    id = r.json()["id"]
    assert (
        client.put(
            "/api/operations/insurance/" + id,
            headers=h,
            json={"revision": 1, "status": "approved"},
        ).status_code
        == 409
    )
    assert (
        client.put(
            "/api/operations/insurance/" + id,
            headers=h,
            json={"revision": 1, "status": "submitted"},
        ).status_code
        == 200
    )
    assert (
        client.put(
            "/api/operations/insurance/" + id,
            headers=h,
            json={"revision": 1, "status": "approved"},
        ).status_code
        == 409
    )
    assert (
        client.put(
            "/api/operations/insurance/" + id,
            headers=h,
            json={"revision": 2, "status": "more_info"},
        ).status_code
        == 200
    )
    assert (
        client.put(
            "/api/operations/insurance/" + id,
            headers=h,
            json={
                "revision": 3,
                "status": "approved",
                "note": "Accord vérifié par humain",
            },
        ).status_code
        == 200
    )


def test_finance_exact_cents_immutable_corrections(client, auth, make_est):
    est, h, jid = setup(client, auth, make_est)
    path = "/api/operations/cases/" + jid + "/finance"

    def add(kind, amount):
        return client.post(
            path,
            headers=h,
            json={
                "kind": kind,
                "amount_cents": amount,
                "reference": "REF-test",
                "confirmed": True,
            },
        )

    assert add("quote", 100001).status_code == 201
    assert add("quote", 100001).status_code == 409
    assert add("coverage", 100002).status_code == 422
    add("coverage", 70000)
    add("deposit", 20000)
    f = add("refund", 1000).json()
    assert f["balance"] == 11001 and f["net_deposits"] == 19000
    assert add("refund", 20000).status_code == 422
    deposit = next(r["id"] for r in f["entries"] if r["kind"] == "deposit")
    assert (
        client.post(
            "/api/operations/finance/" + deposit + "/void",
            headers=h,
            json={"reason": "Erreur"},
        ).status_code
        == 409
    )
    refund = next(r["id"] for r in f["entries"] if r["kind"] == "refund")
    assert (
        client.post(
            "/api/operations/finance/" + refund + "/void",
            headers=h,
            json={"reason": "Correction"},
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/operations/finance/" + refund + "/void",
            headers=h,
            json={"reason": "Correction"},
        ).status_code
        == 409
    )


def test_draft_owner_encryption_cas(client, auth, make_est, db_factory):
    est = make_est()
    h = auth(est)
    url = "/api/operations/drafts/test"
    assert (
        client.put(
            url, headers=h, json={"revision": 0, "payload": {"name": "SECRET PATIENT"}}
        ).json()["revision"]
        == 1
    )
    assert (
        client.put(url, headers=h, json={"revision": 0, "payload": {}}).status_code
        == 409
    )
    assert client.get(url, headers=auth(est, sub="other")).json()["payload"] is None
    with db_factory() as db:
        assert (
            b"SECRET PATIENT" not in db.scalar(select(m.SavedDraft)).encrypted_payload
        )


def test_integration_idempotency_revocation_and_tenant(client, auth, make_est):
    est, h, jid = setup(client, auth, make_est)
    conn = client.post(
        "/api/operations/connections", headers=h, json={"name": "SIH test"}
    ).json()
    key = {"X-Integration-Key": conn["token"]}
    b = {
        "external_id": "EXT-1",
        "patient": {
            "first_name": "Fictive",
            "last_name": "Test",
            "birth_date": "01/01/1980",
            "informed": True,
        },
        "surgery_date": str(today()),
    }
    a = client.post("/api/operations/exchange/admissions", headers=key, json=b)
    assert a.status_code == 201, a.text
    assert a.json()["created"]
    again = client.post(
        "/api/operations/exchange/admissions", headers=key, json=b
    ).json()
    assert not again["created"] and again["id"] == a.json()["id"]
    assert (
        len(client.get("/api/operations/exchange/status", headers=key).json()["items"])
        == 1
    )
    client.delete("/api/operations/connections/" + conn["id"], headers=h)
    assert client.get("/api/operations/exchange/status", headers=key).status_code == 401


def test_message_idempotency_consent_and_delivery_auth(
    client, auth, make_est, monkeypatch, db_factory
):
    _, h, jid = setup(client, auth, make_est)
    url = "/api/operations/cases/" + jid + "/messages"
    b = {"request_key": "message-1", "approved": True}
    assert client.post(url, headers=h, json=b).status_code == 409
    ph = patient(client, h, jid)
    monkeypatch.setattr(get_settings(), "messaging_provider", "console")
    r = client.post(url, headers=h, json=b)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "simulated"
    assert client.post(url, headers=h, json=b).json()["id"] == r.json()["id"]
    assert (
        client.post(url, headers=h, json={**b, "request_key": "message-2"}).status_code
        == 409
    )
    with db_factory() as db:
        dispatch = db.get(m.Dispatch, uuid.UUID(r.json()["id"]))
        msg = db.get(m.MessageLog, dispatch.message_id)
        msg.provider_ref = "brevo-ref"
        msg.status = "sent"
        db.commit()
    monkeypatch.setattr(
        get_settings(), "messaging_webhook_secret", "secret-webhook-32chars"
    )
    event = {"message-id": "brevo-ref", "event": "delivered"}
    assert client.post("/api/operations/webhooks/brevo", json=event).status_code == 401
    wh = {"Authorization": "Bearer secret-webhook-32chars"}
    assert (
        client.post(
            "/api/operations/webhooks/brevo", headers=wh, json=event
        ).status_code
        == 200
    )
    client.post(
        "/api/operations/webhooks/brevo", headers=wh, json={**event, "event": "request"}
    )
    assert client.get(url, headers=h).json()["items"][0]["status"] == "delivered"


def test_companion_grant_limited_revocable_and_no_rights(client, auth, make_est):
    _, h, jid = setup(client, auth, make_est)
    ph = patient(client, h, jid)
    g = client.post(
        "/api/operations/portal/delegations",
        headers=ph,
        json={"label": "Proche fictif"},
    ).json()
    token = g["link"].split("/accompagner/")[1]
    session = client.post(
        "/api/operations/companion/session", json={"token": token, "code": g["code"]}
    )
    assert session.status_code == 200, session.text
    ch = {"Authorization": "Bearer " + session.json()["access_token"]}
    assert client.get("/api/portal/me", headers=ch).status_code == 200
    assert client.get("/api/operations/portal/overview", headers=ch).json()["delegate"]
    assert (
        client.post(
            "/api/operations/portal/delegations",
            headers=ch,
            json={"label": "Unauthorized"},
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/portal/consent", headers=ch, json={"accept": True}
        ).status_code
        == 403
    )
    assert client.get("/api/portal/my-data", headers=ch).status_code == 403
    client.delete("/api/operations/portal/delegations/" + g["id"], headers=ph)
    assert client.get("/api/portal/me", headers=ch).status_code == 401


def test_companion_attempt_limit_and_profile_human_review(client, auth, make_est):
    _, h, jid = setup(client, auth, make_est)
    ph = patient(client, h, jid)
    g = client.post(
        "/api/operations/portal/delegations", headers=ph, json={"label": "Fictive"}
    ).json()
    token = g["link"].split("/accompagner/")[1]
    wrong = "999999" if g["code"] != "999999" else "111111"
    for _ in range(5):
        assert (
            client.post(
                "/api/operations/companion/session",
                json={"token": token, "code": wrong},
            ).status_code
            == 401
        )
    assert (
        client.post(
            "/api/operations/companion/session",
            json={"token": token, "code": g["code"]},
        ).status_code
        == 401
    )
    before = client.get("/api/operations/portal/overview", headers=ph).json()["profile"]
    req = client.post(
        "/api/operations/portal/profile",
        headers=ph,
        json={"phone": "+212612345679", "email": "test@example.com"},
    ).json()
    assert (
        client.get("/api/operations/portal/overview", headers=ph).json()["profile"]
        == before
    )
    assert (
        client.post(
            "/api/operations/events/" + req["id"] + "/confirm-profile", headers=h
        ).status_code
        == 200
    )
    assert (
        client.get("/api/operations/portal/overview", headers=ph).json()["profile"][
            "email"
        ]
        == "test@example.com"
    )


def test_real_observations_and_duplicate_suggestions(client, auth, make_est):
    _, h, jid = setup(client, auth, make_est)
    assert client.get("/api/operations/metrics", headers=h).json()["observations"] == []
    for cohort, seconds in [("baseline", 120), ("pilot", 75)]:
        assert (
            client.post(
                "/api/operations/observations",
                headers=h,
                json={
                    "activity": "document_check",
                    "cohort": cohort,
                    "seconds": seconds,
                },
            ).status_code
            == 200
        )
    r = client.get("/api/operations/metrics", headers=h).json()["observations"][0]
    assert r["observed_difference_seconds"] == 45
    assert (
        len(
            client.post(
                "/api/operations/duplicates",
                headers=h,
                json={
                    "first_name": "Khadija",
                    "last_name": "Alaoui",
                    "birth_date": "14/03/1986",
                },
            ).json()["items"]
        )
        == 1
    )


def test_purge_new_operation_content_and_export(client, auth, make_est, db_factory):
    _, h, jid = setup(client, auth, make_est)
    ph = patient(client, h, jid)
    client.post(
        "/api/operations/portal/messages",
        headers=ph,
        json={"journey_id": jid, "text": "Private reply"},
    )
    assert (
        client.get("/api/portal/my-data", headers=ph).json()["journeys"][0][
            "administrative_messages"
        ][0]["body"]
        == "Private reply"
    )
    with db_factory() as db:
        j = db.get(m.PatientJourney, uuid.UUID(jid))
        pat = db.get(m.Patient, j.patient_id)
        compliance.anonymize_patient(db, pat)
        db.commit()
        d = db.scalar(select(m.Dispatch))
        assert "Private reply" not in o.decrypt(d.encrypted_body)
    assert client.get("/api/operations/portal/overview", headers=ph).status_code == 410


def test_brevo_transports_are_mocked_and_fail_closed(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "brevo_api_key", "dummy-test-key")
    monkeypatch.setattr(s, "brevo_sender_email", "sender@example.com")
    monkeypatch.setattr(s, "brevo_whatsapp_sender", "212600000000")
    monkeypatch.setattr(s, "brevo_whatsapp_template_fr", 123)
    calls = []

    class Reply:
        status_code = 201

        def json(self):
            return {"messageId": "provider-unique-ref"}

    def post(url, **kwargs):
        calls.append((url, kwargs))
        return Reply()

    monkeypatch.setattr(messaging.httpx, "post", post)
    b = messaging.BrevoProvider()
    assert (
        b.send("email", "recipient@example.com", "Test", "Administrative test").status
        == "sent"
    )
    assert (
        calls[-1][0].endswith("/smtp/email")
        and calls[-1][1]["json"]["textContent"] == "Administrative test"
    )
    assert (
        b.send("sms", "+212600000001", "Test", "Administrative test").status == "sent"
    )
    assert calls[-1][1]["json"]["recipient"] == "212600000001"
    assert (
        b.send("whatsapp", "+212600000001", "Test", "Administrative test").status
        == "sent"
    )
    assert calls[-1][1]["json"]["templateId"] == 123
    assert (
        b.send(
            "whatsapp",
            "+212600000001",
            "Test",
            "Visit https://example.com/private-link",
        ).status
        == "failed"
    )
    monkeypatch.setattr(s, "brevo_api_key", "")
    assert b.send("email", "x@example.com", "Test", "Test").status == "failed"


def test_site_header_never_grants_access(client, auth, make_est):
    import jwt

    a, b = make_est(), make_est("Other")
    h = auth(a)
    h["X-Establishment-ID"] = str(b)
    assert client.get("/api/operations/worklist", headers=h).status_code == 403
    s = get_settings()
    token = jwt.encode(
        {
            "sub": "user-1",
            "establishment_id": str(a),
            "establishment_ids": [str(b)],
            "aud": s.oidc_audience,
            "realm_access": {"roles": ["admin"]},
        },
        s.jwt_test_secret,
        algorithm="HS256",
    )
    h = {"Authorization": "Bearer " + token, "X-Establishment-ID": str(b)}
    assert client.get("/api/me", headers=h).json()["establishment"] == "Other"
    assert len(client.get("/api/operations/sites", headers=h).json()["items"]) == 2


def test_preadmission_support_and_reschedule_preserve_completed_tasks(
    client, auth, make_est, db_factory
):
    _, h, jid = setup(client, auth, make_est)
    ph = patient(client, h, jid)
    assert (
        client.post(
            "/api/operations/portal/support",
            headers=ph,
            json={"text": "Besoin d’aide administrative"},
        ).status_code
        == 200
    )
    d = client.get("/api/operations/cases/" + jid, headers=h).json()
    support = d["support"][0]["id"]
    assert (
        client.post(
            "/api/operations/support/" + support + "/resolve", headers=h
        ).status_code
        == 200
    )
    with db_factory() as db:
        j = db.get(m.PatientJourney, uuid.UUID(jid))
        old = j.surgery_date
        t = j.tasks[0]
        t.status = "done"
        original = t.due_date
        tid = t.id
        db.commit()
    assert (
        client.post(
            "/api/operations/cases/" + jid + "/reschedule",
            headers=h,
            json={
                "date": str(old + dt.timedelta(days=3)),
                "reason": "Date transmise par établissement",
            },
        ).status_code
        == 200
    )
    with db_factory() as db:
        assert db.get(m.Task, tid).due_date == original
    assert (
        client.put(
            "/api/operations/setup",
            headers=h,
            json={"contact_start_hour": 20, "contact_end_hour": 8},
        ).status_code
        == 422
    )
    assert (
        client.put(
            "/api/operations/setup",
            headers=h,
            json={"support_email": "admissions@example.com"},
        ).status_code
        == 200
    )
    assert (
        client.get("/api/portal/me", headers=ph).json()["contacts"]["email"]
        == "admissions@example.com"
    )


def test_patient_can_stop_reminders_without_closing_journey(
    client, auth, make_est, monkeypatch
):
    _, h, jid = setup(client, auth, make_est)
    ph = patient(client, h, jid)
    assert (
        client.post(
            "/api/operations/portal/notifications", headers=ph, json={"enabled": False}
        ).status_code
        == 200
    )
    assert not client.get("/api/operations/portal/overview", headers=ph).json()[
        "notifications_enabled"
    ]
    assert (
        client.post(
            "/api/operations/cases/" + jid + "/messages",
            headers=h,
            json={"request_key": "optout-test", "approved": True},
        ).status_code
        == 409
    )
    assert client.get("/api/journeys/" + jid + "/detail", headers=h).status_code == 200
    assert (
        client.post(
            "/api/operations/portal/notifications", headers=ph, json={"enabled": True}
        ).status_code
        == 200
    )


def test_staff_adoption_excludes_patient_rights_and_support_events(
    make_est, db_factory
):
    est = make_est()
    with db_factory() as db:
        for actor, action, detail in [
            ("staff", "task.complete", {}),
            ("oidc-patient-uuid", "rights.access_export", {}),
            ("oidc-patient-uuid", "support.request", {}),
            (
                "another-patient",
                "operations.profile_requested",
                {"actor_roles": ["patient"]},
            ),
            ("integration:demo", "journey.create", {"actor_roles": ["coordinator"]}),
        ]:
            db.add(
                m.AuditLog(
                    establishment_id=est,
                    actor=actor,
                    action=action,
                    entity="patient",
                    entity_id="test",
                    detail=detail,
                )
            )
        db.commit()
        assert o.measures(db, est)["adoption"] == 1
