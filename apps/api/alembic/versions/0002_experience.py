"""Additive migration: document readings, action plans, procedures and support requests.

No existing patient records are modified or removed.
"""
from alembic import op
from app import models as m

revision = "0002"
down_revision = "0001"


def upgrade():
    for table in (m.DocumentReading.__table__, m.ActionPlan.__table__, m.ProcedureCard.__table__, m.SupportRequest.__table__):
        table.create(op.get_bind(), checkfirst=True)


def downgrade():
    for table in (m.SupportRequest.__table__, m.ProcedureCard.__table__, m.ActionPlan.__table__, m.DocumentReading.__table__):
        table.drop(op.get_bind(), checkfirst=True)
