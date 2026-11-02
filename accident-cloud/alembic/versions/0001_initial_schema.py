"""initial schema

Revision ID: 0001
Revises:
Creates only tables that do not exist yet (checkfirst), so running it against a database that
already holds accident data never drops or recreates anything. Later changes: use
`alembic revision --autogenerate -m "..."` and review the generated file.
"""
from alembic import op

from app import models  # noqa: F401
from app.database import Base

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    Base.metadata.create_all(bind=op.get_bind(), checkfirst=True)


def downgrade():
    raise NotImplementedError("Refusing to drop tables: accident records must be preserved.")
