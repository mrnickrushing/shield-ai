"""realtime monitoring schema

Revision ID: 0f1e2d3c4b5a
Revises: 9a0b1c2d3e4f
Create Date: 2026-07-05 19:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0f1e2d3c4b5a"
down_revision: Union[str, None] = "9a0b1c2d3e4f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "monitored_identities",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("target_type", sa.String(), nullable=False),
        sa.Column("value", sa.String(), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_status", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "target_type", "value", name="uq_monitored_identity_user_target"),
    )
    op.create_index(op.f("ix_monitored_identities_user_id"), "monitored_identities", ["user_id"])

    op.create_table(
        "browser_telemetry_events",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("domain", sa.String(), nullable=False),
        sa.Column("verdict", sa.String(), nullable=False),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_browser_telemetry_events_user_id"), "browser_telemetry_events", ["user_id"])
    op.create_index(op.f("ix_browser_telemetry_events_domain"), "browser_telemetry_events", ["domain"])

    op.create_table(
        "extension_telemetry_events",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("extension_type", sa.String(), nullable=False),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("counts", sa.JSON(), nullable=False),
        sa.Column("detail", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_extension_telemetry_events_user_id"), "extension_telemetry_events", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_extension_telemetry_events_user_id"), table_name="extension_telemetry_events")
    op.drop_table("extension_telemetry_events")
    op.drop_index(op.f("ix_browser_telemetry_events_domain"), table_name="browser_telemetry_events")
    op.drop_index(op.f("ix_browser_telemetry_events_user_id"), table_name="browser_telemetry_events")
    op.drop_table("browser_telemetry_events")
    op.drop_index(op.f("ix_monitored_identities_user_id"), table_name="monitored_identities")
    op.drop_table("monitored_identities")
