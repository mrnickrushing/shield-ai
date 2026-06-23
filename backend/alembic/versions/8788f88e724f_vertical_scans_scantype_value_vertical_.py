"""vertical scans: scantype value + vertical_key column

Revision ID: 8788f88e724f
Revises: e6a1b2c3d4e5
Create Date: 2026-06-23 04:00:29.361019
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '8788f88e724f'
down_revision: Union[str, None] = 'e6a1b2c3d4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Persist Shield Labs vertical scans in scan_history alongside normal scans.
    # ALTER TYPE … ADD VALUE is safe inside a transaction in PostgreSQL 12+
    # (Railway uses PG 16). SQLite stores enums as TEXT so no enum change is needed.
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE scantype ADD VALUE IF NOT EXISTS 'vertical'")

    op.add_column("scan_history", sa.Column("vertical_key", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("scan_history", "vertical_key")
    # The 'vertical' value is left in the scantype enum (PostgreSQL cannot drop a
    # single enum value without recreating the type).
