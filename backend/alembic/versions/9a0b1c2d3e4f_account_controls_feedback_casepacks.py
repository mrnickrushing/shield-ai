"""account controls, feedback details, notification preferences, case packs

Revision ID: 9a0b1c2d3e4f
Revises: a7b8c9d0e1f2
Create Date: 2026-07-05 18:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "9a0b1c2d3e4f"
down_revision: Union[str, None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("devices", sa.Column("label", sa.String(), nullable=False, server_default=""))
    op.add_column("devices", sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("devices", sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("refresh_token_hash", sa.String(), nullable=False),
        sa.Column("user_agent", sa.String(), nullable=False),
        sa.Column("ip_address", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("refresh_token_hash"),
    )
    op.create_index(op.f("ix_auth_sessions_user_id"), "auth_sessions", ["user_id"])
    op.create_index(op.f("ix_auth_sessions_refresh_token_hash"), "auth_sessions", ["refresh_token_hash"])

    op.create_table(
        "notification_preferences",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("push_enabled", sa.Boolean(), nullable=False),
        sa.Column("email_enabled", sa.Boolean(), nullable=False),
        sa.Column("proactive_monitoring", sa.Boolean(), nullable=False),
        sa.Column("quiet_hours_enabled", sa.Boolean(), nullable=False),
        sa.Column("quiet_hours_start", sa.String(), nullable=False),
        sa.Column("quiet_hours_end", sa.String(), nullable=False),
        sa.Column("minimum_severity", sa.String(), nullable=False),
        sa.Column("topics", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(op.f("ix_notification_preferences_user_id"), "notification_preferences", ["user_id"])

    op.create_table(
        "privacy_preferences",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("retention_days", sa.Integer(), nullable=True),
        sa.Column("require_device_unlock", sa.Boolean(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(op.f("ix_privacy_preferences_user_id"), "privacy_preferences", ["user_id"])

    op.create_table(
        "scan_feedback_details",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("scan_id", sa.String(), nullable=False),
        sa.Column("feedback", sa.String(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("corrected_context", sa.Text(), nullable=False),
        sa.Column("evidence", sa.Text(), nullable=False),
        sa.Column("review_status", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["scan_id"], ["scan_history.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_scan_feedback_details_user_id"), "scan_feedback_details", ["user_id"])
    op.create_index(op.f("ix_scan_feedback_details_scan_id"), "scan_feedback_details", ["scan_id"])

    op.create_table(
        "case_pack_shares",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("incident_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("token_hash", sa.String(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["incident_id"], ["incidents.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(op.f("ix_case_pack_shares_incident_id"), "case_pack_shares", ["incident_id"])
    op.create_index(op.f("ix_case_pack_shares_user_id"), "case_pack_shares", ["user_id"])
    op.create_index(op.f("ix_case_pack_shares_token_hash"), "case_pack_shares", ["token_hash"])


def downgrade() -> None:
    op.drop_index(op.f("ix_case_pack_shares_token_hash"), table_name="case_pack_shares")
    op.drop_index(op.f("ix_case_pack_shares_user_id"), table_name="case_pack_shares")
    op.drop_index(op.f("ix_case_pack_shares_incident_id"), table_name="case_pack_shares")
    op.drop_table("case_pack_shares")
    op.drop_index(op.f("ix_scan_feedback_details_scan_id"), table_name="scan_feedback_details")
    op.drop_index(op.f("ix_scan_feedback_details_user_id"), table_name="scan_feedback_details")
    op.drop_table("scan_feedback_details")
    op.drop_index(op.f("ix_privacy_preferences_user_id"), table_name="privacy_preferences")
    op.drop_table("privacy_preferences")
    op.drop_index(op.f("ix_notification_preferences_user_id"), table_name="notification_preferences")
    op.drop_table("notification_preferences")
    op.drop_index(op.f("ix_auth_sessions_refresh_token_hash"), table_name="auth_sessions")
    op.drop_index(op.f("ix_auth_sessions_user_id"), table_name="auth_sessions")
    op.drop_table("auth_sessions")
    op.drop_column("devices", "revoked_at")
    op.drop_column("devices", "last_seen_at")
    op.drop_column("devices", "label")
