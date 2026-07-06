"""voice scans: scantype value 'voice' for voicemail/call transcript analysis

Revision ID: b9c8d7e6f5a4
Revises: 0f1e2d3c4b5a
Create Date: 2026-07-06 14:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = "b9c8d7e6f5a4"
down_revision: Union[str, None] = "0f1e2d3c4b5a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Same pattern as the 'vertical' enum addition: safe in-transaction on
    # PG 12+ (Railway runs PG 16); SQLite stores enums as TEXT.
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE scantype ADD VALUE IF NOT EXISTS 'voice'")


def downgrade() -> None:
    # Removing an enum value requires a type rebuild; not worth it.
    pass
