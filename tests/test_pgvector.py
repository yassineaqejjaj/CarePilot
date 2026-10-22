"""Recherche pgvector réelle (opérateur de distance cosinus). Ignoré sans PG_TEST_URL.

    PG_TEST_URL=postgresql+psycopg://carepilot:carepilot@localhost:5442/carepilot pytest tests/test_pgvector.py
"""
import os
import uuid

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from ai.providers.base import CallContext
from ai.providers.mock_provider import MockProvider
from ai.rag.service import RagService
from app import models as m
from app import services as svc

PG = os.environ.get("PG_TEST_URL")
pytestmark = pytest.mark.skipif(not PG, reason="PG_TEST_URL non défini")


@pytest.fixture()
def db():
    engine = create_engine(PG)
    with Session(engine) as s:
        yield s
        s.rollback()  # aucune donnée de test conservée


def _doc(db, est, title, text, rag, status):
    d = m.KnowledgeDocument(establishment_id=est, title=title, status=status)
    db.add(d)
    db.flush()
    rag.ingest(CallContext(str(est), "rag"), str(d.id), text)


def test_pgvector_ranking_approval_and_tenant_filter(db):
    prov = MockProvider(dim=1536)
    rag = RagService(prov, svc.SqlVectorStore(db))
    a, b = (uuid.uuid4() for _ in range(2))
    for e in (a, b):
        db.add(m.Establishment(id=e, name=f"t-{e}"))
    db.flush()
    _doc(db, a, "Pièces d'identité", "carte identité passeport pièce obligatoire admission", rag, "approved")
    _doc(db, a, "Parking", "stationnement parking visiteurs horaires", rag, "approved")
    _doc(db, a, "Brouillon", "carte identité passeport pièce obligatoire admission", rag, "draft")
    _doc(db, b, "Autre clinique", "carte identité passeport pièce obligatoire admission", rag, "approved")

    hits = rag.retrieve(CallContext(str(a), "rag"), "pièce identité passeport", k=5)
    titles = [h.title for h in hits]
    assert titles[0] == "Pièces d'identité"          # classement par proximité
    assert set(titles) == {"Pièces d'identité", "Parking"}  # ni brouillon, ni autre établissement
