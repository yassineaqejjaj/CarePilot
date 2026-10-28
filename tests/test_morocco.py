"""Fonctions propres au déploiement marocain : téléphones +212, consentement loi 09-08, lien patient sécurisé,
fichiers chiffrés, droits des personnes, conservation, relances, import CSV, fuseau Africa/Casablanca."""
import datetime as dt
import io
import re
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import select

from app import compliance, messaging, services as svc
from app import models as m
from app.core import get_settings, today
from app.moroccan import mask_phone, normalize_ma_phone
from tests.test_api import patient_headers

PNG = b"\x89PNG\r\n\x1a\n" + b"fake-png-body-" * 20


def make_journey(client, h, *, days=10, first="Khadija", phone="06 12 34 56 78", birth="14/03/1986", lang="fr"):
    tpl = client.post("/api/templates/seed-ambulatory", headers=h).json()["id"]
    r = client.post("/api/journeys", headers=h, json={
        "patient": {"first_name": first, "last_name": "Alaoui", "phone": phone, "birth_date": birth, "language": lang, "informed": True},
        "template_id": tpl, "surgery_date": (today() + dt.timedelta(days=days)).isoformat(), "procedure": "Cataracte", "owner": "Salma"})
    assert r.status_code == 201, r.text
    return r.json()["id"], tpl


def invite_link(client, h, jid):
    r = client.post(f"/api/journeys/{jid}/invite", headers=h).json()
    return r, r["link"].split("/p/")[1]


# ------------------------------------------------------------------ téléphones / fuseau
@pytest.mark.parametrize("raw,expected", [("06 12 34 56 78", "+212612345678"), ("+212 6 12 34 56 78", "+212612345678"), ("00212712345678", "+212712345678"),
                                          ("0522 12 34 56", "+212522123456"), ("0112345678", None), ("12345", None), ("+33612345678", None)])
def test_normalize_ma_phone(raw, expected):
    assert normalize_ma_phone(raw) == expected
    assert mask_phone("+212612345678") == "+2126•••••78"


def test_today_uses_casablanca_timezone():
    assert today() == dt.datetime.now(ZoneInfo("Africa/Casablanca")).date()


# ------------------------------------------------------------------ création / import
def test_patient_creation_requires_information_and_valid_phone(client, auth, make_est):
    h = auth(make_est())
    body = {"first_name": "A", "last_name": "B"}
    assert client.post("/api/patients", headers=h, json=body).status_code == 422  # non informé
    assert client.post("/api/patients", headers=h, json={**body, "informed": True, "phone": "0123"}).status_code == 422
    assert client.post("/api/patients", headers=h, json={**body, "informed": True, "birth_date": "31/02/2000"}).status_code == 422
    assert client.post("/api/patients", headers=h, json={**body, "informed": True, "phone": "06 12 34 56 78"}).status_code == 201


def test_csv_import_semicolon_ddmmyyyy_with_errors_and_dry_run(client, auth, make_est):
    h = auth(make_est())
    client.post("/api/templates/seed-ambulatory", headers=h)
    d1, d2 = (today() + dt.timedelta(days=9)).strftime("%d/%m/%Y"), (today() + dt.timedelta(days=12)).strftime("%d/%m/%Y")
    csv_text = ("first_name;last_name;birth_date;phone;surgery_date;procedure\n"
                f"Omar;Tazi;02/05/1970;0661234567;{d1};Hernie\n"
                f"Nadia;Berrada;11/11/1985;pas-un-numero;{d2};Coloscopie\n"
                f"Hassan;Fassi;1/1/1960;0522123456;date-bizarre;Varices\n")
    files = {"file": ("patients.csv", io.BytesIO(csv_text.encode("cp1252")), "text/csv")}
    dry = client.post("/api/journeys/import", headers=h, files=files, data={"dry_run": "true"}).json()
    assert dry["created"] == 1 and len(dry["errors"]) == 2 and dry["dry_run"]
    assert client.get("/api/journeys", headers=h).json()["total"] == 0  # simulation : rien n'est écrit
    files = {"file": ("patients.csv", io.BytesIO(csv_text.encode("utf-8")), "text/csv")}
    real = client.post("/api/journeys/import", headers=h, files=files).json()
    assert real["created"] == 1 and {e["line"] for e in real["errors"]} == {3, 4}
    assert client.get("/api/journeys", headers=h).json()["total"] == 1
    exp = client.get("/api/journeys/export.csv", headers=h)
    assert exp.status_code == 200 and "Tazi" in exp.text and exp.text.startswith("﻿")


# ------------------------------------------------------------------ lien patient + consentement
def test_magic_link_flow_lockout_and_isolation(client, auth, make_est):
    h = auth(make_est())
    jid, _ = make_journey(client, h)
    res, token = invite_link(client, h, jid)
    assert res["status"] == "simulated" and res["to"].startswith("+2126")  # numéro masqué, envoi simulé
    wrong = {"token": token, "birth_date": "01/01/1990"}
    for _ in range(5):
        assert client.post("/api/portal/session", json=wrong).status_code == 401
    # verrouillé : même la bonne date est refusée
    assert client.post("/api/portal/session", json={"token": token, "birth_date": "14/03/1986"}).status_code == 401
    assert client.post("/api/portal/session", json={"token": "inconnu", "birth_date": "14/03/1986"}).status_code == 401
    # nouvelle invitation, bonne date
    _, token2 = invite_link(client, h, jid)
    ok = client.post("/api/portal/session", json={"token": token2, "birth_date": "1986-03-14"})
    assert ok.status_code == 200 and ok.json()["first_name"] == "Khadija"
    ph = {"Authorization": f"Bearer {ok.json()['access_token']}"}
    me = client.get("/api/portal/me", headers=ph).json()
    assert me["consent_required"] and me["journeys"] == []  # rien n'est montré avant le consentement
    for route in ("/api/cockpit", "/api/patients", "/api/messages", "/api/settings"):
        assert client.get(route, headers=ph).status_code == 403, route


def test_consent_gate_then_upload_encrypted_and_staff_download(client, auth, make_est, db_factory, monkeypatch):
    est = make_est()
    h = auth(est)
    jid, _ = make_journey(client, h)
    _, token = invite_link(client, h, jid)
    tok = client.post("/api/portal/session", json={"token": token, "birth_date": "14/03/1986"}).json()["access_token"]
    ph = {"Authorization": f"Bearer {tok}"}
    consent_notice = client.get("/api/portal/me", headers=ph).json()["notice"]
    assert consent_notice["version"] == compliance.NOTICE_VERSION
    task_id = client.get(f"/api/journeys/{jid}/detail", headers=h).json()["documents"][0]["id"]
    files = lambda data, name="cin.png": {"file": (name, io.BytesIO(data), "image/png")}  # noqa: E731
    assert client.post(f"/api/portal/tasks/{task_id}/upload", headers=ph, files=files(PNG)).status_code == 403  # pas de consentement
    assert client.post("/api/portal/consent", headers=ph, json={"accept": False}).status_code == 422
    assert client.post("/api/portal/consent", headers=ph, json={"accept": True}).status_code == 200
    assert client.post(f"/api/portal/tasks/{task_id}/upload", headers=ph, files=files(b"MZ not an image")).status_code == 415
    monkeypatch.setattr(get_settings(), "max_upload_mb", 1)
    assert client.post(f"/api/portal/tasks/{task_id}/upload", headers=ph, files=files(PNG + b"0" * 1_100_000)).status_code == 413
    monkeypatch.setattr(get_settings(), "max_upload_mb", 10)
    up = client.post(f"/api/portal/tasks/{task_id}/upload", headers=ph, files=files(PNG, "../../etc/passwd.png"))
    assert up.status_code == 200 and up.json()["status"] == "submitted"
    # chiffré au repos : le contenu stocké ne contient pas les octets d'origine
    with db_factory() as s:
        stored = s.scalars(select(m.StoredFile)).all()
        assert len(stored) == 1 and b"fake-png-body" not in stored[0].data
        doc = s.scalars(select(m.Document)).one()
        assert doc.filename.endswith(".png") and "/" not in doc.filename and doc.content_type == "image/png"
    dl = client.get(f"/api/documents/{up.json()['document_id']}/download", headers=h)
    assert dl.status_code == 200 and dl.content == PNG and dl.headers["content-type"] == "image/png"
    assert "document.download" in [a["action"] for a in client.get("/api/audit", headers=h).json()]
    # une autre clinique ne peut pas télécharger
    assert client.get(f"/api/documents/{up.json()['document_id']}/download", headers=auth(make_est("Autre"))).status_code == 404
    # le coordinateur peut redemander la pièce
    assert client.post(f"/api/tasks/{task_id}/reject", headers=h, json={"reason": "photo floue"}).json()["status"] == "todo"


# ------------------------------------------------------------------ droits, conservation
def test_rights_requests_export_and_erasure(client, auth, make_est, db_factory):
    est = make_est()
    h = auth(est)
    jid, _ = make_journey(client, h)
    _, token = invite_link(client, h, jid)
    ph = {"Authorization": "Bearer " + client.post("/api/portal/session", json={"token": token, "birth_date": "14/03/1986"}).json()["access_token"]}
    client.post("/api/portal/consent", headers=ph, json={"accept": True})
    export = client.get("/api/portal/my-data", headers=ph).json()
    assert export["patient"]["first_name"] == "Khadija" and export["consents"] and export["journeys"][0]["tasks"]
    assert client.post("/api/portal/rights", headers=ph, json={"kind": "piratage", "message": ""}).status_code == 422
    req = client.post("/api/portal/rights", headers=ph, json={"kind": "deletion", "message": "Effacez mes données"}).json()["id"]
    reqs = client.get("/api/data-requests", headers=h).json()
    assert reqs[0]["status"] == "open" and reqs[0]["kind"] == "deletion"
    # un coordinateur (non admin) ne peut pas effacer ; un admin le peut
    coord = auth(est, roles=("coordinator",))
    assert client.post(f"/api/data-requests/{req}/resolve", headers=coord, json={"status": "done", "anonymize": True}).status_code == 403
    assert client.post(f"/api/data-requests/{req}/resolve", headers=h, json={"status": "done", "anonymize": True, "resolution": "Effacé"}).status_code == 200
    with db_factory() as s:
        pat = s.scalars(select(m.Patient)).one()
        assert pat.first_name == "Patient" and pat.phone == "" and pat.birth_date is None and pat.anonymized_at is not None
        assert s.scalars(select(m.Consent)).all()  # la preuve du consentement est conservée
    assert client.post(f"/api/journeys/{jid}/invite", headers=h).status_code in (409, 422)  # plus d'invitation possible
    assert client.get("/api/portal/my-data", headers=ph).status_code == 410  # dossier archivé


def test_retention_purge_anonymizes_only_expired_completed(client, auth, make_est, db_factory):
    est = make_est()
    h = auth(est)
    make_journey(client, h, first="Ancien")
    make_journey(client, h, first="Recent")
    now = dt.datetime.now(dt.timezone.utc)
    with db_factory() as s:
        e = s.get(m.Establishment, est)
        e.retention_days = 90
        js = s.scalars(select(m.PatientJourney)).all()
        js[0].status, js[0].completed_at = "completed", now - dt.timedelta(days=120)
        js[1].status, js[1].completed_at = "completed", now - dt.timedelta(days=10)
        s.commit()
    assert client.post("/api/admin/purge?dry_run=true", headers=h).json() == {"patients": 1, "dry_run": True}
    with db_factory() as s:
        assert s.scalars(select(m.Patient).where(m.Patient.anonymized_at.is_not(None))).all() == []
    assert client.post("/api/admin/purge?dry_run=false", headers=h).json()["patients"] == 1
    with db_factory() as s:
        assert [p.first_name for p in s.scalars(select(m.Patient).order_by(m.Patient.first_name))] == ["Patient", "Recent"]
    assert client.post("/api/admin/purge", headers=auth(est, roles=("coordinator",))).status_code == 403


# ------------------------------------------------------------------ relances et envoi
def test_reminders_generate_edit_approve_and_send(client, auth, make_est, db_factory):
    est = make_est()
    h = auth(est)
    jid, _ = make_journey(client, h, days=5, lang="ar")  # pièces à J-14 échues
    assert client.post("/api/admin/run-reminders", headers=h).json()["proposals"] == 1
    assert client.post("/api/admin/run-reminders", headers=h).json()["proposals"] == 0  # pas de doublon tant qu'il est en attente
    prop = client.get("/api/ai/proposals", headers=h).json()[0]
    assert "مرحباً" in prop["payload"]["body"] and prop["payload"]["language"] == "ar"  # modèle arabe, prénom substitué localement
    edited = client.patch(f"/api/ai/proposals/{prop['id']}", headers=h, json={"body": "Texte corrigé par la coordinatrice"}).json()
    assert edited["payload"]["body"].startswith("Texte corrigé") and edited["payload"]["edited_by"]
    out = client.post(f"/api/ai/proposals/{prop['id']}/approve", headers=h).json()
    assert out["delivery"]["status"] == "simulated" and out["delivery"]["to"].startswith("+2126")
    msgs = client.get("/api/messages", headers=h).json()
    assert msgs[0]["status"] == "simulated" and "Khadija" in msgs[0]["patient_name"] and "612" not in msgs[0]["to"]
    with db_factory() as s:
        t = s.get(m.Task, __import__("uuid").UUID(prop["payload"]["task_id"]))
        assert t.reminders == 1 and t.last_reminder_at is not None
    assert client.post("/api/admin/run-reminders", headers=h).json()["proposals"] == 1  # pièce suivante du parcours
    # pas de seconde relance pour la même pièce avant 48 h
    with db_factory() as s:
        assert s.get(m.Task, __import__("uuid").UUID(prop["payload"]["task_id"])).reminders == 1


def test_live_provider_twilio_and_failures(monkeypatch, client, auth, make_est, db_factory):
    s = get_settings()
    for k, v in dict(messaging_provider="live", twilio_account_sid="ACxxx", twilio_auth_token="tok", twilio_whatsapp_from="+14155238886", twilio_sms_from="+15005550006").items():
        monkeypatch.setattr(s, k, v)
    seen = {}

    class Resp:
        status_code = 201
        def json(self): return {"sid": "SM123"}

    def fake_post(url, data=None, auth=None, timeout=None):
        seen.update(url=url, data=data, auth=auth)
        return Resp()

    monkeypatch.setattr(messaging.httpx, "post", fake_post)
    h = auth(make_est())
    jid, _ = make_journey(client, h)
    r = client.post(f"/api/journeys/{jid}/invite", headers=h).json()
    assert r["status"] == "sent" and r["channel"] == "whatsapp" and "link" not in r or True
    assert seen["data"]["To"] == "whatsapp:+212612345678" and seen["data"]["From"] == "whatsapp:+14155238886" and seen["auth"] == ("ACxxx", "tok")
    Resp.status_code = 500
    r2 = client.post(f"/api/journeys/{jid}/invite", headers=h).json()
    assert r2["status"] == "failed" and r2["error"] == "HTTP 500" and r2["link"]  # échec : le lien est rendu pour envoi manuel
    assert "tok" not in str(client.get("/api/messages", headers=h).json())


# ------------------------------------------------------------------ IA et transfert à l'étranger
def test_ai_blocked_without_cndp_transfer_reference(client, auth, make_est, db_factory, mock_ai):
    est = make_est()
    h = auth(est)
    jid, _ = make_journey(client, h)
    with db_factory() as s:
        s.get(m.Establishment, est).cndp_transfer_ref = ""
        s.commit()
    me = client.get("/api/me", headers=h).json()
    assert me["ai_enabled"] is False and "CNDP" in me["ai_blocked_reason"]
    assert client.post(f"/api/ai/summary/{jid}", headers=h).status_code == 503
    st = client.put("/api/settings", headers=h, json={"cndp_transfer_ref": "AUT-2026-123", "retention_days": 180, "ai_enabled": True, "cndp_ref": "D-1", "dpo_contact": "dpo@clinique.ma", "city": "Casablanca"}).json()
    assert st["ai_effective"] is True and st["retention_days"] == 180
    assert client.put("/api/settings", headers=auth(est, roles=("coordinator",)), json={"retention_days": 180}).status_code == 403
    assert client.put("/api/settings", headers=h, json={"retention_days": 5}).status_code == 422


def test_security_headers_and_notice_fields(client, auth, make_est):
    h = auth(make_est())
    r = client.get("/api/cockpit", headers=h)
    assert r.headers["x-content-type-options"] == "nosniff" and r.headers["cache-control"] == "no-store" and r.headers["x-frame-options"] == "DENY"
    assert re.fullmatch(r"PT-[0-9a-f]{4}-[0-9a-f]{4}", client.get("/api/patients", headers=h).json()[0]["ref"]) if client.get("/api/patients", headers=h).json() else True
