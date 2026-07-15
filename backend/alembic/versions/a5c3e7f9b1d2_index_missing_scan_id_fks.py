"""index notifications.scan_id, incidents.linked_scan_id, community_reports.scan_id

Revision ID: a5c3e7f9b1d2
Revises: f3b7d9c1e2a4
Create Date: 2026-07-15 16:30:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = "a5c3e7f9b1d2"
down_revision: Union[str, None] = "f3b7d9c1e2a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(op.f("ix_notifications_scan_id"), "notifications", ["scan_id"])
    op.create_index(op.f("ix_incidents_linked_scan_id"), "incidents", ["linked_scan_id"])
    op.create_index(op.f("ix_community_reports_scan_id"), "community_reports", ["scan_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_community_reports_scan_id"), table_name="community_reports")
    op.drop_index(op.f("ix_incidents_linked_scan_id"), table_name="incidents")
    op.drop_index(op.f("ix_notifications_scan_id"), table_name="notifications")
