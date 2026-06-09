"""phase 2 schema: qr/message/email/phone scans + notifications

Revision ID: b7e9d1a2f3c4
Revises: 3851558f763a
Create Date: 2026-06-09 12:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b7e9d1a2f3c4"
down_revision: Union[str, None] = "3851558f763a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Extend the PostgreSQL scantype enum with Phase 2 values.
    # ALTER TYPE … ADD VALUE is safe inside a transaction in PostgreSQL 12+
    # (Railway uses PG 16). SQLite stores enums as TEXT so no action needed.
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for val in ("qr", "message", "email", "phone"):
            op.execute(f"ALTER TYPE scantype ADD VALUE IF NOT EXISTS '{val}'")

    op.create_table(
        "qr_scans",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("scan_id", sa.String(), nullable=False),
        sa.Column("qr_content", sa.Text(), nullable=False),
        sa.Column("qr_type", sa.String(), nullable=False),
        sa.Column("decoded_url", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["scan_id"], ["scan_history.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_qr_scans_scan_id"), "qr_scans", ["scan_id"])

    op.create_table(
        "message_scans",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("scan_id", sa.String(), nullable=False),
        sa.Column("message_text", sa.Text(), nullable=False),
        sa.Column("platform_hint", sa.String(), nullable=False),
        sa.Column("detected_entities", sa.JSON(), nullable=False),
        sa.Column("extracted_urls", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["scan_id"], ["scan_history.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_message_scans_scan_id"), "message_scans", ["scan_id"])

    op.create_table(
        "email_scans",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("scan_id", sa.String(), nullable=False),
        sa.Column("sender_email", sa.String(), nullable=False),
        sa.Column("sender_display_name", sa.String(), nullable=False),
        sa.Column("reply_to_email", sa.String(), nullable=False),
        sa.Column("subject", sa.String(), nullable=False),
        sa.Column("body_text", sa.Text(), nullable=False),
        sa.Column("extracted_urls", sa.JSON(), nullable=False),
        sa.Column("header_flags", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["scan_id"], ["scan_history.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_email_scans_scan_id"), "email_scans", ["scan_id"])

    op.create_table(
        "phone_scans",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("scan_id", sa.String(), nullable=False),
        sa.Column("phone_number", sa.String(), nullable=False),
        sa.Column("normalized_number", sa.String(), nullable=False),
        sa.Column("country_code", sa.String(), nullable=False),
        sa.Column("carrier", sa.String(), nullable=False),
        sa.Column("line_type", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["scan_id"], ["scan_history.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_phone_scans_scan_id"), "phone_scans", ["scan_id"])

    op.create_table(
        "notifications",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("scan_id", sa.String(), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["scan_id"], ["scan_history.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notifications_user_id"), "notifications", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_notifications_user_id"), table_name="notifications")
    op.drop_table("notifications")
    op.drop_index(op.f("ix_phone_scans_scan_id"), table_name="phone_scans")
    op.drop_table("phone_scans")
    op.drop_index(op.f("ix_email_scans_scan_id"), table_name="email_scans")
    op.drop_table("email_scans")
    op.drop_index(op.f("ix_message_scans_scan_id"), table_name="message_scans")
    op.drop_table("message_scans")
    op.drop_index(op.f("ix_qr_scans_scan_id"), table_name="qr_scans")
    op.drop_table("qr_scans")
    # Note: PostgreSQL enum values cannot be removed once added.
    # Downgrade leaves qr/message/email/phone in the scantype enum.
