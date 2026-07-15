"""profiles: avatar_url for user-uploaded profile photos

Revision ID: e8c2a4f6b1d9
Revises: c9e1f3a5b7d2
Create Date: 2026-07-15 02:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e8c2a4f6b1d9"
down_revision: Union[str, None] = "c9e1f3a5b7d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "profiles",
        sa.Column("avatar_url", sa.String(), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("profiles", "avatar_url")
