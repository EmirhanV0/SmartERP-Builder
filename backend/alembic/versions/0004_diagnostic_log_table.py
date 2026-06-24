"""diagnostic_log table — SelfHealingEngine records

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-23

Seed data: docker-compose exec backend python -m scripts.seed_diagnostics
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "diagnostic_log",
        sa.Column("diag_id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "config_id",
            sa.BigInteger(),
            sa.ForeignKey("configuration.config_id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("failure_stage", sa.String(50), nullable=False),
        sa.Column("error_signature", sa.Text(), nullable=False),
        sa.Column("recovery_action", sa.String(100), nullable=True),
        sa.Column(
            "recovery_status",
            sa.String(20),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    op.execute(
        "CREATE INDEX idx_diagnostic_log_stage_time "
        "ON diagnostic_log(failure_stage, occurred_at DESC)"
    )


def downgrade() -> None:
    op.drop_index("idx_diagnostic_log_stage_time", table_name="diagnostic_log")
    op.drop_table("diagnostic_log")
