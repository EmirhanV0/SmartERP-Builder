"""config_name — add config_name column to configuration

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-13
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "configuration",
        sa.Column("config_name", sa.String(150), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("configuration", "config_name")
