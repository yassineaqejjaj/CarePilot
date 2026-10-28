import datetime as dt


def setup_journey(client, auth, est, surgery_in_days=10):
    h = auth(est)
    tpl = client.post("/api/templates/seed-ambulatory", headers=h).json()["id"]
    pat = client.post("/api/patients", headers=h, json={"first_name": "Alice", "last_name": "Factice", "informed": True}).json()["id"]
    j = client.post("/api/journeys", headers=h, json={
        "patient_id": pat, "template_id": tpl,
        "surgery_date": (dt.date.today() + dt.timedelta(days=surgery_in_days)).isoformat()})
    assert j.status_code == 201
    return h, j.json()["id"], tpl


def test_auth_required(client):
    assert client.get("/api/cockpit").status_code == 401
    assert client.get("/api/cockpit", headers={"Authorization": "Bearer nope"}).status_code == 401


def test_journey_generates_tasks_with_correct_due_dates(client, auth, make_est):
    est = make_est()
    h, jid, _ = setup_journey(client, auth, est, 30)
    tasks = client.get(f"/api/journeys/{jid}/tasks", headers=h).json()
    assert len(tasks) == 15
    assert tasks[0]["due_date"] == (dt.date.today() + dt.timedelta(days=9)).isoformat()  # J-21
    assert tasks[-1]["due_date"] == (dt.date.today() + dt.timedelta(days=37)).isoformat()  # J+7


def test_cockpit_flags_late_journey_and_priority(client, auth, make_est):
    est = make_est()
    h, jid, _ = setup_journey(client, auth, est, surgery_in_days=5)  # pièces J-14 échues depuis 2 jours
    c = client.get("/api/cockpit", headers=h).json()
    assert c["kpis"]["active"] == 1 and c["queue"][0]["journey_id"] == jid
    assert c["queue"][0]["priority"] in ("urgent", "high")
    assert c["kpis"]["tasks_to_treat"] > 0
    d = client.get(f"/api/journeys/{jid}/detail", headers=h).json()
    assert d["patient"]["name"] == "Alice Factice" and len(d["timeline"]) == 15 and len(d["documents"]) == 5
    assert client.get("/api/journeys", headers=h).json()["total"] == 1


def test_tenant_isolation(client, auth, make_est):
    a, b = make_est("A"), make_est("B")
    ha, jid, tpl = setup_journey(client, auth, a)
    hb = auth(b)
    assert client.get(f"/api/journeys/{jid}/tasks", headers=hb).status_code == 404
    assert client.get("/api/patients", headers=hb).json() == []
    assert client.get("/api/cockpit", headers=hb).json()["kpis"]["active"] == 0
    assert client.get(f"/api/journeys/{jid}/detail", headers=hb).status_code == 404
    assert client.get("/api/journeys", headers=hb).json()["total"] == 0
    pat_b = client.post("/api/patients", headers=hb, json={"first_name": "B", "last_name": "B", "informed": True}).json()["id"]
    r = client.post("/api/journeys", headers=hb, json={"patient_id": pat_b, "template_id": tpl,
                                                       "surgery_date": "2030-01-01"})
    assert r.status_code == 404  # template d'un autre établissement


def test_rbac(client, auth, make_est):
    est = make_est()
    viewer = auth(est, roles=("viewer",))
    assert client.post("/api/patients", headers=viewer, json={"first_name": "x", "last_name": "y", "informed": True}).status_code == 403
    assert client.get("/api/cockpit", headers=viewer).status_code == 200


def test_template_versioning_and_publish(client, auth, make_est):
    est = make_est()
    h, _, tpl = setup_journey(client, auth, est)
    v2 = client.post(f"/api/templates/{tpl}/new-version", headers=h).json()
    assert v2["version"] == 2 and v2["status"] == "draft"
    assert client.post(f"/api/templates/{v2['id']}/publish", headers=h).status_code == 200
    statuses = {t["version"]: t["status"] for t in client.get("/api/templates", headers=h).json()}
    assert statuses == {1: "archived", 2: "published"}


def test_complete_task_updates_analytics_and_audit(client, auth, make_est):
    est = make_est()
    h, jid, _ = setup_journey(client, auth, est)
    t = client.get(f"/api/journeys/{jid}/tasks", headers=h).json()[0]
    assert client.post(f"/api/tasks/{t['id']}/complete", headers=h).status_code == 200
    assert "task.complete" in [a["action"] for a in client.get("/api/audit", headers=h).json()]
    assert client.get("/api/analytics", headers=h).json()["completeness_rate"] is not None


def patient_headers(auth, est, patient_id):
    import jwt
    from app.core import get_settings
    s = get_settings()
    tok = jwt.encode({"sub": "pat", "establishment_id": str(est), "patient_id": patient_id, "aud": s.oidc_audience,
                      "realm_access": {"roles": ["patient"]}}, s.jwt_test_secret, algorithm="HS256")
    return {"Authorization": f"Bearer {tok}"}


def test_designer_edits_draft_only(client, auth, make_est):
    est = make_est()
    h, _, tpl = setup_journey(client, auth, est)
    steps = [{"offset_days": -5, "title": "Étape", "kind": "document", "required_document": "x", "blocking": True}]
    assert client.put(f"/api/templates/{tpl}/steps", headers=h, json=steps).status_code == 409  # publié
    v2 = client.post(f"/api/templates/{tpl}/new-version", headers=h).json()["id"]
    assert client.put(f"/api/templates/{v2}/steps", headers=h, json=steps).status_code == 200
    assert client.put(f"/api/templates/{v2}/steps", headers=h, json=[{**steps[0], "kind": "zz"}]).status_code == 422
    assert len(client.get("/api/templates", headers=h).json()) == 2


def test_portal_patient_scope_and_submit(client, auth, make_est):
    est = make_est()
    h, jid, _ = setup_journey(client, auth, est)
    pid = client.get("/api/patients", headers=h).json()[0]["id"]
    other = client.post("/api/patients", headers=h, json={"first_name": "Bob", "last_name": "F", "informed": True}).json()["id"]
    ph = patient_headers(auth, est, pid)
    assert client.post("/api/portal/consent", headers=ph, json={"accept": True}).status_code == 200
    me = client.get("/api/portal/me", headers=ph).json()
    assert me["first_name"] == "Alice" and all(t["kind"] in ("document", "questionnaire", "message") for t in me["journeys"][0]["tasks"])
    tid = next(t["id"] for t in me["journeys"][0]["tasks"] if t["can_submit"])
    assert client.post(f"/api/portal/tasks/{tid}/submit", headers=ph, json={"response": {"ok": 1}}).json()["status"] == "submitted"
    assert client.post(f"/api/portal/tasks/{tid}/submit", headers=ph, json={}).status_code == 409
    # un autre patient du même établissement ne peut pas soumettre cette tâche
    oh = patient_headers(auth, est, other)
    assert client.post("/api/portal/consent", headers=oh, json={"accept": True}).status_code == 200
    assert client.post(f"/api/portal/tasks/{tid}/submit", headers=oh, json={}).status_code == 404
    # un patient n'accède pas aux routes du personnel
    for route in ("/api/cockpit", "/api/patients", "/api/templates", "/api/analytics", f"/api/journeys/{jid}/tasks"):
        assert client.get(route, headers=ph).status_code == 403, route
