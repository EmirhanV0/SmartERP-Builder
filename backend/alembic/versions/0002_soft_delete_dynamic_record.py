"""Soft delete — add is_deleted column to dynamic_record

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-03
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "dynamic_record",
        sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False),
    )
    # Index to speed up soft-delete queries
    op.create_index(
        "idx_dynamic_record_is_deleted",
        "dynamic_record",
        ["map_id", "is_deleted"],
    )


def downgrade() -> None:
    op.drop_index("idx_dynamic_record_is_deleted", table_name="dynamic_record")
    op.drop_column("dynamic_record", "is_deleted")
