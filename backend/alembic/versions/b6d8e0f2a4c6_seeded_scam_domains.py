"""seeded_scam_domains: external phishing-domain feed for the Safari blocklist

Revision ID: b6d8e0f2a4c6
Revises: a3f5c7e9d1b2
Create Date: 2026-07-08 14:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b6d8e0f2a4c6"
down_revision: Union[str, None] = "a3f5c7e9d1b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "seeded_scam_domains",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("domain", sa.String(), nullable=False),
        sa.Column("source", sa.String(), nullable=False, server_default="phishing_feeds"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_seeded_scam_domains_domain", "seeded_scam_domains", ["domain"], unique=True
    )


def downgrade() -> None:
    op.drop_index("ix_seeded_scam_domains_domain", table_name="seeded_scam_domains")
    op.drop_table("seeded_scam_domains")
