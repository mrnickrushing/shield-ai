"""index phone_scans.normalized_number for reputation aggregation

Revision ID: f1a2b3c4d5e6
Revises: 8788f88e724f
Create Date: 2026-07-05 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "8788f88e724f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        op.f("ix_phone_scans_normalized_number"), "phone_scans", ["normalized_number"]
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_phone_scans_normalized_number"), table_name="phone_scans")
