"""add users.premium_expires_at and users.rc_product_id for RevenueCat billing

Revision ID: a7b8c9d0e1f2
Revises: f1a2b3c4d5e6
Create Date: 2026-07-05 17:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("premium_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("rc_product_id", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "rc_product_id")
    op.drop_column("users", "premium_expires_at")
