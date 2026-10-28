"""Administrative coordination, ledger, delegation and integrations. Additive only."""

from alembic import op
from app import models as m

revision = "0003"
down_revision = "0002"
TABLES = (
    m.TeamMember,
    m.AdministrativeCase,
    m.InsuranceCase,
    m.AdministrativeEvent,
    m.FinanceEntry,
    m.SavedDraft,
    m.TimeObservation,
    m.IntegrationConnection,
    m.ExternalAdmission,
    m.CompanionGrant,
    m.Dispatch,
    m.FacilityPreferences,
    m.PatientContactPreference,
)


def upgrade():
    for model in TABLES:
        model.__table__.create(op.get_bind(), checkfirst=True)


def downgrade():
    for model in reversed(TABLES):
        model.__table__.drop(op.get_bind(), checkfirst=True)
