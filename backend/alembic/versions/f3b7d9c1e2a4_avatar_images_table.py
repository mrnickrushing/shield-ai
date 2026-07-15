"""avatar_images: store user profile photo bytes in the app database

Revision ID: f3b7d9c1e2a4
Revises: e8c2a4f6b1d9
Create Date: 2026-07-15 02:40:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f3b7d9c1e2a4"
down_revision: Union[str, None] = "e8c2a4f6b1d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "avatar_images",
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("data", sa.LargeBinary(), nullable=False),
        sa.Column("content_type", sa.String(), nullable=False, server_default="image/jpeg"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("avatar_images")
