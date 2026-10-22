from types import SimpleNamespace

import pytest

from ai.agents.agents import (DraftOutput, FollowUpOutput, SummaryOutput, VerificationOutput)
from ai.guardrails import contains_direct_identifier, redact
from ai.providers.base import AIDisabledError, BudgetExceededError, CallContext, GuardrailError
from ai.providers.openai_provider import OpenAIProvider
from ai.rag.service import chunk_text
from tests.test_api import setup_journey

PROC = "Documents requis avant intervention : pièce d'identité, carte vitale, mutuelle.\n\nLe consentement administratif doit être signé."


def kb(client, h, title="Procédure admission", text=PROC, approve=True):
    d = client.post("/api/ai/documents", headers=h, json={"title": title, "text": text}).json()
    if approve:
        client.post(f"/api/ai/documents/{d['id']}/approve", headers=h)
    return d["id"]


# ------------------------------------------------------------ guardrails
def test_redaction():
    t, found = redact("Mail jean@ex.fr tel 06 12 34 56 78 NIR 1 85 05 78 006 084 36")
    assert set(found) == {"EMAIL", "PHONE", "NIR"} and not contains_direct_identifier(t)


def test_chunking_respects_size():
    assert all(len(c) <= 1700 for c in chunk_text("mot " * 3000)) and chunk_text("") == []


# ------------------------------------------------------------ provider OpenAI (faux client)
class FakeClient:
    def __init__(self):
        self.responses = SimpleNamespace(parse=self._parse)
        self.embeddings = SimpleNamespace(create=lambda **k: SimpleNamespace(
            data=[SimpleNamespace(embedding=[0.1, 0.2]) for _ in k["input"]], usage=SimpleNamespace(total_tokens=7)))
        self.last = None

    def _parse(self, **kw):
        self.last = kw
        return SimpleNamespace(output_parsed=SummaryOutput(facts=["ok"]),
                               usage=SimpleNamespace(input_tokens=1000, output_tokens=500))


def test_openai_provider_cost_budget_and_guardrails():
    recs = []
    p = OpenAIProvider(llm_model="m", embedding_model="e", price_in_per_1m_eur=2.0, price_out_per_1m_eur=8.0,
                       usage_sink=recs.append, client=FakeClient())
    ctx = CallContext("est", "summary")
    out = p.generate_structured(ctx, instructions="i", user_input="x", schema=SummaryOutput)
    assert out.facts == ["ok"] and recs[0].cost_eur == pytest.approx(0.006)
    assert p._client.last["store"] is False
    assert p.embed(ctx, ["a"]) == [[0.1, 0.2]]
    with pytest.raises(BudgetExceededError):
        p.generate_structured(CallContext("e", "a", monthly_token_budget=10, tokens_used_this_month=10),
                              instructions="i", user_input="x", schema=SummaryOutput)
    with pytest.raises(AIDisabledError):
        p.embed(CallContext("e", "a", ai_enabled=False), ["a"])
    with pytest.raises(GuardrailError):
        p.generate_structured(ctx, instructions="i", user_input="écrire à a@b.fr", schema=SummaryOutput)


# ------------------------------------------------------------ RAG
def test_rag_only_approved_and_same_establishment(client, auth, make_est, mock_ai):
    a, b = make_est("A"), make_est("B")
    ha, hb = auth(a), auth(b)
    _, jid_a, _ = setup_journey(client, auth, a)
    _, jid_b, _ = setup_journey(client, auth, b)
    kb(client, ha, title="Proc A approuvée")
    kb(client, ha, title="Proc A brouillon", approve=False)
    mock_ai.set_response(VerificationOutput, VerificationOutput(anomalies=[], summary="ras"))

    client.post(f"/api/ai/verify/{jid_a}", headers=ha)
    assert "Proc A approuvée" in mock_ai.calls[-1]["input"]
    assert "brouillon" not in mock_ai.calls[-1]["input"]
    client.post(f"/api/ai/verify/{jid_b}", headers=hb)
    assert "Proc A" not in mock_ai.calls[-1]["input"]  # aucune fuite inter-établissements


# ------------------------------------------------------------ agents + validation humaine
def test_verify_agent_computes_missing_docs_and_creates_pending_proposal(client, auth, make_est, mock_ai):
    est = make_est()
    h, jid, _ = setup_journey(client, auth, est)
    mock_ai.set_response(VerificationOutput, VerificationOutput(anomalies=["échéance proche"], summary="s"))
    r = client.post(f"/api/ai/verify/{jid}", headers=h).json()
    assert set(r["payload"]["missing_documents"]) == {"piece_identite", "carte_vitale", "mutuelle", "consentement_admin", "questionnaire_admission"}
    assert r["status"] == "pending"
    pid = r["proposal_id"]
    assert client.post(f"/api/ai/proposals/{pid}/approve", headers=h).json()["status"] == "approved"
    assert client.post(f"/api/ai/proposals/{pid}/reject", headers=h).status_code == 409
    # le statut des tâches n'a pas été modifié par l'agent
    assert all(t["status"] == "todo" for t in client.get(f"/api/journeys/{jid}/tasks", headers=h).json())


def test_communication_agent_substitutes_name_locally_and_blocks_medical(client, auth, make_est, mock_ai):
    est = make_est()
    h, jid, _ = setup_journey(client, auth, est)
    body = {"journey_id": jid, "approved_template": "Bonjour {{patient_first_name}}", "purpose": "rappel"}
    mock_ai.set_response(DraftOutput, DraftOutput(subject="Rappel", body="Bonjour {{patient_first_name}}, pensez à votre dossier."))
    r = client.post("/api/ai/communicate", headers=h, json=body).json()
    assert "Alice" in r["payload"]["body"] and r["payload"]["requires_validation"] is True
    assert "Alice" not in mock_ai.calls[-1]["input"]  # le prénom ne part pas vers l'IA
    mock_ai.set_response(DraftOutput, DraftOutput(subject="x", body="Arrêtez votre traitement"))
    assert client.post("/api/ai/communicate", headers=h, json=body).status_code == 422


def test_followup_redacts_patient_reply(client, auth, make_est, mock_ai):
    est = make_est()
    h, jid, _ = setup_journey(client, auth, est)
    mock_ai.set_response(FollowUpOutput, FollowUpOutput(category="question", proposed_actions=["notify_coordinator"]))
    r = client.post("/api/ai/followup", headers=h, json={"journey_id": jid, "patient_reply": "Appelez-moi au 06 12 34 56 78"})
    assert r.status_code == 200 and "06 12" not in mock_ai.calls[-1]["input"]
    assert r.json()["payload"]["needs_human"] is True


def test_ai_kill_switch_and_budget(client, auth, make_est, mock_ai):
    off = make_est("Off", ai_enabled=False)
    h, jid, _ = setup_journey(client, auth, off)
    mock_ai.set_response(SummaryOutput, SummaryOutput(facts=["f"]))
    assert client.post(f"/api/ai/summary/{jid}", headers=h).status_code == 503


def test_usage_tracking_endpoint(client, auth, make_est, db_factory, mock_ai):
    from app import services as svc
    est = make_est()
    h, jid, _ = setup_journey(client, auth, est)
    mock_ai.set_response(SummaryOutput, SummaryOutput(facts=["f"]))
    with db_factory() as s:  # branche le sink comme en production
        mock_ai.usage_sink = svc.usage_sink(s)
        client.post(f"/api/ai/summary/{jid}", headers=h)
        s.commit()
    u = client.get("/api/ai/usage", headers=h).json()
    assert u[0]["agent"] == "summary" and u[0]["calls"] == 1
