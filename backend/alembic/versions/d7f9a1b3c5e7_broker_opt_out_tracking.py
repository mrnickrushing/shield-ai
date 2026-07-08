"""broker_opt_outs: listing_url + last_recheck_at for opt-out letters and re-check alerts

Revision ID: d7f9a1b3c5e7
Revises: b6d8e0f2a4c6
Create Date: 2026-07-08 19:30:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d7f9a1b3c5e7"
down_revision: Union[str, None] = "b6d8e0f2a4c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "broker_opt_outs",
        sa.Column("listing_url", sa.String(), nullable=False, server_default=""),
    )
    op.add_column(
        "broker_opt_outs",
        sa.Column("last_recheck_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("broker_opt_outs", "last_recheck_at")
    op.drop_column("broker_opt_outs", "listing_url")
