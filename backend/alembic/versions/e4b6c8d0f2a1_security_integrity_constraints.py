"""security integrity constraints and scheduled-query indexes

Revision ID: e4b6c8d0f2a1
Revises: a5c3e7f9b1d2
Create Date: 2026-07-16 10:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e4b6c8d0f2a1"
down_revision: Union[str, None] = "a5c3e7f9b1d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _dedupe_devices() -> None:
    bind = op.get_bind()
    rows = bind.execute(
        sa.text("SELECT id, push_token FROM devices ORDER BY created_at DESC")
    ).mappings()
    seen: set[str] = set()
    delete_ids: list[str] = []
    for row in rows:
        token = (row["push_token"] or "").strip()
        if not token or token in seen:
            delete_ids.append(row["id"])
        else:
            seen.add(token)
    for device_id in delete_ids:
        bind.execute(sa.text("DELETE FROM devices WHERE id = :id"), {"id": device_id})


def _dedupe_education_progress() -> None:
    bind = op.get_bind()
    rows = bind.execute(
        sa.text("SELECT id, user_id, lesson_id FROM education_progress ORDER BY completed_at DESC")
    ).mappings()
    seen: set[tuple[str, str]] = set()
    for row in rows:
        key = (row["user_id"], row["lesson_id"])
        if key in seen:
            bind.execute(sa.text("DELETE FROM education_progress WHERE id = :id"), {"id": row["id"]})
        else:
            seen.add(key)


def upgrade() -> None:
    _dedupe_devices()
    _dedupe_education_progress()

    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("rc_last_event_at", sa.DateTime(timezone=True), nullable=True))

    with op.batch_alter_table("devices") as batch:
        batch.alter_column("push_token", existing_type=sa.String(), nullable=False)
        batch.create_unique_constraint("uq_devices_push_token", ["push_token"])

    with op.batch_alter_table("education_progress") as batch:
        batch.create_unique_constraint(
            "uq_education_progress_user_lesson", ["user_id", "lesson_id"]
        )

    op.create_index(
        "ix_scan_history_user_created", "scan_history", ["user_id", "created_at"]
    )
    op.create_index(
        "ix_monitored_identities_active_checked",
        "monitored_identities",
        ["is_active", "last_checked_at"],
    )
    op.create_index(
        "ix_incidents_status_updated", "incidents", ["status", "updated_at"]
    )
    op.create_index(
        "ix_broker_opt_outs_status_recheck",
        "broker_opt_outs",
        ["status", "last_recheck_at"],
    )
    op.create_table(
        "oauth_authorization_codes",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("code_hash", sa.String(), nullable=False),
        sa.Column("code_challenge", sa.String(), nullable=False),
        sa.Column("redirect_uri", sa.String(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_oauth_authorization_codes_user_id", "oauth_authorization_codes", ["user_id"])
    op.create_index("ix_oauth_authorization_codes_code_hash", "oauth_authorization_codes", ["code_hash"], unique=True)
    with op.batch_alter_table("notifications") as batch:
        batch.add_column(sa.Column("severity", sa.String(), nullable=False, server_default="low"))
        batch.add_column(sa.Column("topic", sa.String(), nullable=False, server_default="account"))
        batch.add_column(sa.Column("route", sa.String(), nullable=False, server_default="/notifications"))
    with op.batch_alter_table("incidents") as batch:
        batch.alter_column(
            "amount_lost",
            existing_type=sa.Float(),
            type_=sa.Numeric(14, 2),
            existing_nullable=True,
        )
    op.create_table(
        "billing_webhook_events",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("event_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("event_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("handled", sa.Boolean(), nullable=False),
        sa.Column("detail", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_billing_webhook_events_event_id", "billing_webhook_events", ["event_id"], unique=True)
    op.create_index("ix_billing_webhook_events_user_id", "billing_webhook_events", ["user_id"])
    op.create_table(
        "push_receipts",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("device_id", sa.String(), nullable=False),
        sa.Column("ticket_id", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("last_error", sa.Text(), nullable=False),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_push_receipts_device_id", "push_receipts", ["device_id"])
    op.create_index("ix_push_receipts_status", "push_receipts", ["status"])
    op.create_index("ix_push_receipts_ticket_id", "push_receipts", ["ticket_id"], unique=True)
    op.create_index("ix_push_receipts_user_id", "push_receipts", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_push_receipts_user_id", table_name="push_receipts")
    op.drop_index("ix_push_receipts_ticket_id", table_name="push_receipts")
    op.drop_index("ix_push_receipts_status", table_name="push_receipts")
    op.drop_index("ix_push_receipts_device_id", table_name="push_receipts")
    op.drop_table("push_receipts")
    op.drop_index("ix_billing_webhook_events_user_id", table_name="billing_webhook_events")
    op.drop_index("ix_billing_webhook_events_event_id", table_name="billing_webhook_events")
    op.drop_table("billing_webhook_events")
    with op.batch_alter_table("incidents") as batch:
        batch.alter_column(
            "amount_lost",
            existing_type=sa.Numeric(14, 2),
            type_=sa.Float(),
            existing_nullable=True,
        )
    with op.batch_alter_table("notifications") as batch:
        batch.drop_column("route")
        batch.drop_column("topic")
        batch.drop_column("severity")
    op.drop_index("ix_oauth_authorization_codes_code_hash", table_name="oauth_authorization_codes")
    op.drop_index("ix_oauth_authorization_codes_user_id", table_name="oauth_authorization_codes")
    op.drop_table("oauth_authorization_codes")
    op.drop_index("ix_broker_opt_outs_status_recheck", table_name="broker_opt_outs")
    op.drop_index("ix_incidents_status_updated", table_name="incidents")
    op.drop_index("ix_monitored_identities_active_checked", table_name="monitored_identities")
    op.drop_index("ix_scan_history_user_created", table_name="scan_history")
    with op.batch_alter_table("education_progress") as batch:
        batch.drop_constraint("uq_education_progress_user_lesson", type_="unique")
    with op.batch_alter_table("devices") as batch:
        batch.drop_constraint("uq_devices_push_token", type_="unique")
        batch.alter_column("push_token", existing_type=sa.String(), nullable=True)
    with op.batch_alter_table("users") as batch:
        batch.drop_column("rc_last_event_at")
