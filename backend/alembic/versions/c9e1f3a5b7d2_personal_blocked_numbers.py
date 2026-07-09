"""personal_blocked_numbers: per-user call blocklist

Revision ID: c9e1f3a5b7d2
Revises: d7f9a1b3c5e7
Create Date: 2026-07-09 16:30:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c9e1f3a5b7d2"
down_revision: Union[str, None] = "d7f9a1b3c5e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "personal_blocked_numbers",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("number", sa.String(), nullable=False, index=True),
        sa.Column("label", sa.String(), nullable=False, server_default="Blocked"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "number", name="uq_personal_block_user_number"),
    )


def downgrade() -> None:
    op.drop_table("personal_blocked_numbers")
