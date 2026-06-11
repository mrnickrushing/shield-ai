"""add social identities for durable Apple/Google account mapping

Revision ID: e6a1b2c3d4e5
Revises: d2e4f6a8b0c1
Create Date: 2026-06-10 17:30:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e6a1b2c3d4e5"
down_revision: Union[str, None] = "d2e4f6a8b0c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "social_identities",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("subject", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", "subject", name="uq_social_identities_provider_subject"),
    )
    op.create_index(op.f("ix_social_identities_user_id"), "social_identities", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_social_identities_user_id"), table_name="social_identities")
    op.drop_table("social_identities")
