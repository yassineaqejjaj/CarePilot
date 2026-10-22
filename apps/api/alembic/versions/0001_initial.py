"""Schéma initial + extension pgvector.

Écrit à la main (pas d'autogenerate : aucune base disponible lors de la rédaction).
Les migrations suivantes doivent être générées avec `alembic revision --autogenerate`.
"""
from alembic import op
from app import models

revision = "0001"
down_revision = None


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    models.Base.metadata.create_all(op.get_bind())


def downgrade():
    models.Base.metadata.drop_all(op.get_bind())
