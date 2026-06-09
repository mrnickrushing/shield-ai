"""phase 3 schema: marketplace/social scans + breach records + identity alerts

Revision ID: c8f3a5b2e1d0
Revises: b7e9d1a2f3c4
Create Date: 2026-06-09 14:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c8f3a5b2e1d0"
down_revision: Union[str, None] = "b7e9d1a2f3c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for val in ("marketplace", "social"):
            op.execute(f"ALTER TYPE scantype ADD VALUE IF NOT EXISTS '{val}'")

    op.create_table(
        "marketplace_scans",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("scan_id", sa.String(), nullable=False),
        sa.Column("content_text", sa.Text(), nullable=False),
        sa.Column("platform", sa.String(), nullable=False),
        sa.Column("detected_signals", sa.JSON(), nullable=False),
        sa.Column("extracted_urls", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["scan_id"], ["scan_history.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_marketplace_scans_scan_id"), "marketplace_scans", ["scan_id"])

    op.create_table(
        "social_scans",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("scan_id", sa.String(), nullable=False),
        sa.Column("content_text", sa.Text(), nullable=False),
        sa.Column("platform", sa.String(), nullable=False),
        sa.Column("detected_signals", sa.JSON(), nullable=False),
        sa.Column("extracted_urls", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["scan_id"], ["scan_history.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_social_scans_scan_id"), "social_scans", ["scan_id"])

    op.create_table(
        "breach_records",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("breach_count", sa.Integer(), nullable=False),
        sa.Column("severity", sa.String(), nullable=False),
        sa.Column("breaches", sa.JSON(), nullable=False),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_breach_records_user_id"), "breach_records", ["user_id"])
    op.create_index(op.f("ix_breach_records_email"), "breach_records", ["email"])

    op.create_table(
        "identity_alerts",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("alert_type", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("detail", sa.JSON(), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_identity_alerts_user_id"), "identity_alerts", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_identity_alerts_user_id"), table_name="identity_alerts")
    op.drop_table("identity_alerts")
    op.drop_index(op.f("ix_breach_records_email"), table_name="breach_records")
    op.drop_index(op.f("ix_breach_records_user_id"), table_name="breach_records")
    op.drop_table("breach_records")
    op.drop_index(op.f("ix_social_scans_scan_id"), table_name="social_scans")
    op.drop_table("social_scans")
    op.drop_index(op.f("ix_marketplace_scans_scan_id"), table_name="marketplace_scans")
    op.drop_table("marketplace_scans")
    # Note: PostgreSQL enum values cannot be removed once added.
