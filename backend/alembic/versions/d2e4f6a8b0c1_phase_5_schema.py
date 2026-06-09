"""phase 5 schema: api_keys, community_reports, scam_patterns + user flags

Revision ID: d2e4f6a8b0c1
Revises: c8f3a5b2e1d0
Create Date: 2026-06-09 16:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d2e4f6a8b0c1"
down_revision: Union[str, None] = "c8f3a5b2e1d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_admin and is_developer columns to users
    op.add_column("users", sa.Column("is_admin", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("users", sa.Column("is_developer", sa.Boolean(), nullable=False, server_default="false"))

    op.create_table(
        "api_keys",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("key_hash", sa.String(), nullable=False),
        sa.Column("key_prefix", sa.String(), nullable=False),
        sa.Column("scopes", sa.JSON(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key_hash"),
    )
    op.create_index(op.f("ix_api_keys_user_id"), "api_keys", ["user_id"])

    op.create_table(
        "community_reports",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("scan_id", sa.String(), nullable=True),
        sa.Column("report_type", sa.String(), nullable=False),
        sa.Column("artifact_text", sa.Text(), nullable=False),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("platform_hint", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("analyst_notes", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["scan_id"], ["scan_history.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_community_reports_user_id"), "community_reports", ["user_id"])

    op.create_table(
        "scam_patterns",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("pattern_type", sa.String(), nullable=False),
        sa.Column("artifact_types", sa.JSON(), nullable=False),
        sa.Column("pattern_data", sa.JSON(), nullable=False),
        sa.Column("risk_score_boost", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )


def downgrade() -> None:
    op.drop_table("scam_patterns")
    op.drop_index(op.f("ix_community_reports_user_id"), table_name="community_reports")
    op.drop_table("community_reports")
    op.drop_index(op.f("ix_api_keys_user_id"), table_name="api_keys")
    op.drop_table("api_keys")
    op.drop_column("users", "is_developer")
    op.drop_column("users", "is_admin")
