from alembic import context
from sqlalchemy import create_engine

from app import models
from app.core import get_settings

def run():
    engine = create_engine(get_settings().database_url)
    with engine.connect() as conn:
        context.configure(connection=conn, target_metadata=models.Base.metadata)
        with context.begin_transaction():
            context.run_migrations()

run()
