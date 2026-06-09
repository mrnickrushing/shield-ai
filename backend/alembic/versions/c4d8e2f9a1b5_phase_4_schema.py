"""Phase 4 schema — incidents, trusted_contacts, education

Revision ID: c4d8e2f9a1b5
Revises: b7e9d1a2f3c4
Create Date: 2026-06-09
"""
from alembic import op
import sqlalchemy as sa

revision = "c4d8e2f9a1b5"
down_revision = "b7e9d1a2f3c4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "incidents",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("incident_type", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="open"),
        sa.Column("title", sa.String(), nullable=False, server_default=""),
        sa.Column("amount_lost", sa.Float(), nullable=True),
        sa.Column("currency", sa.String(), nullable=False, server_default="USD"),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("linked_scan_id", sa.String(), sa.ForeignKey("scan_history.id"), nullable=True),
        sa.Column("steps_completed", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_incidents_user_id", "incidents", ["user_id"])

    op.create_table(
        "incident_evidence",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("incident_id", sa.String(), sa.ForeignKey("incidents.id"), nullable=False),
        sa.Column("evidence_type", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("label", sa.String(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_incident_evidence_incident_id", "incident_evidence", ["incident_id"])

    op.create_table(
        "trusted_contacts",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("phone", sa.String(), nullable=False, server_default=""),
        sa.Column("email", sa.String(), nullable=False, server_default=""),
        sa.Column("relationship_label", sa.String(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_trusted_contacts_user_id", "trusted_contacts", ["user_id"])

    op.create_table(
        "education_lessons",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("slug", sa.String(), nullable=False, unique=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("summary", sa.String(), nullable=False, server_default=""),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("threat_category", sa.String(), nullable=False, server_default=""),
        sa.Column("difficulty", sa.String(), nullable=False, server_default="beginner"),
        sa.Column("estimated_minutes", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("quiz_questions", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_education_lessons_slug", "education_lessons", ["slug"])

    op.create_table(
        "education_progress",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("lesson_id", sa.String(), sa.ForeignKey("education_lessons.id"), nullable=False),
        sa.Column("completed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("quiz_score", sa.Integer(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_education_progress_user_id", "education_progress", ["user_id"])
    op.create_index("ix_education_progress_lesson_id", "education_progress", ["lesson_id"])

    # Accessibility column on profiles
    op.add_column("profiles", sa.Column("large_text_mode", sa.Boolean(), nullable=False, server_default="false"))


def downgrade() -> None:
    op.drop_column("profiles", "large_text_mode")
    op.drop_table("education_progress")
    op.drop_table("education_lessons")
    op.drop_table("trusted_contacts")
    op.drop_table("incident_evidence")
    op.drop_table("incidents")
