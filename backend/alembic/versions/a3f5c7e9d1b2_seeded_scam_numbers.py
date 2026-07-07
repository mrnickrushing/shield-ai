"""seeded_scam_numbers: external scam-number feed for call protection

Revision ID: a3f5c7e9d1b2
Revises: c1d2e3f4a5b6
Create Date: 2026-07-07 10:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a3f5c7e9d1b2"
down_revision: Union[str, None] = "c1d2e3f4a5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "seeded_scam_numbers",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("number", sa.String(), nullable=False),
        sa.Column("label", sa.String(), nullable=False, server_default="Spam Risk"),
        sa.Column("source", sa.String(), nullable=False, server_default="fcc_complaints"),
        sa.Column("report_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_seeded_scam_numbers_number", "seeded_scam_numbers", ["number"], unique=True
    )


def downgrade() -> None:
    op.drop_index("ix_seeded_scam_numbers_number", table_name="seeded_scam_numbers")
    op.drop_table("seeded_scam_numbers")
