import os

os.environ.update(AUTH_MODE="test", ENV="test", OIDC_AUDIENCE="carepilot-api")

import uuid

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from ai.providers.mock_provider import MockProvider
from app import models as m
from app.core import get_db, get_settings
from app.main import app
from app.routers.ai_routes import get_provider


@pytest.fixture()
def db_factory():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    m.Base.metadata.create_all(engine)
    return sessionmaker(engine, expire_on_commit=False)


@pytest.fixture()
def mock_ai():
    return MockProvider()


@pytest.fixture()
def client(db_factory, mock_ai):
    def _db():
        with db_factory() as s:
            yield s

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_provider] = lambda: mock_ai
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture()
def make_est(db_factory):
    def _make(name="Clinique A", ai_enabled=True, budget=1_000_000) -> uuid.UUID:
        with db_factory() as s:
            e = m.Establishment(name=name, ai_enabled=ai_enabled, monthly_token_budget=budget, cndp_transfer_ref="TEST-TRANSFER")
            s.add(e)
            s.commit()
            return e.id
    return _make


@pytest.fixture()
def auth():
    def _auth(est: uuid.UUID, roles=("admin",), sub="user-1") -> dict:
        s = get_settings()
        tok = jwt.encode({"sub": sub, "establishment_id": str(est), "aud": s.oidc_audience,
                          "realm_access": {"roles": list(roles)}}, s.jwt_test_secret, algorithm="HS256")
        return {"Authorization": f"Bearer {tok}"}
    return _auth
