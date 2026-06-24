"""Initial tables — 7 static tables

Revision ID: 0001
Revises:
Create Date: 2026-04-11
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. TENANT_PROFILE
    op.create_table(
        "tenant_profile",
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_name", sa.String(255), nullable=False),
        sa.Column("sector_code", sa.String(100), nullable=False),
        sa.Column("subscription_plan", sa.String(50), server_default="free"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )

    # 2. USERS
    op.create_table(
        "users",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenant_profile.tenant_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("role", sa.String(50), server_default="user"),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )

    # 3. AVAILABLE_MODULE
    op.create_table(
        "available_module",
        sa.Column("module_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("module_name", sa.String(100), unique=True, nullable=False),
        sa.Column(
            "base_schema_json",
            postgresql.JSONB(),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("is_system_default", sa.Boolean(), server_default="true"),
    )
    # GIN index — fast JSONB queries
    op.create_index(
        "idx_available_module_schema_gin",
        "available_module",
        ["base_schema_json"],
        postgresql_using="gin",
    )

    # 4. CONFIGURATION
    op.create_table(
        "configuration",
        sa.Column("config_id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenant_profile.tenant_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(50), server_default="draft"),
        sa.Column("ai_confidence_score", sa.Float(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )

    # 5. CONFIG_MODULE_MAP
    op.create_table(
        "config_module_map",
        sa.Column("map_id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "config_id",
            sa.BigInteger(),
            sa.ForeignKey("configuration.config_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "module_id",
            sa.Integer(),
            sa.ForeignKey("available_module.module_id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("custom_schema_json", postgresql.JSONB(), nullable=True),
        sa.Column("display_name", sa.String(255), nullable=True),
        sa.Column("is_enabled", sa.Boolean(), server_default="true"),
    )
    # GIN index — custom schema search
    op.create_index(
        "idx_config_module_map_schema_gin",
        "config_module_map",
        ["custom_schema_json"],
        postgresql_using="gin",
    )

    # 6. DYNAMIC_RECORD
    op.create_table(
        "dynamic_record",
        sa.Column("record_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "map_id",
            sa.BigInteger(),
            sa.ForeignKey("config_module_map.map_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.user_id", ondelete="SET NULL"),
            nullable=False,
        ),
        sa.Column(
            "data_payload", postgresql.JSONB(), nullable=False, server_default="{}"
        ),
        sa.Column("search_vector", postgresql.TSVECTOR(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )
    # GIN indexes — JSONB + full-text search
    op.create_index(
        "idx_dynamic_record_payload_gin",
        "dynamic_record",
        ["data_payload"],
        postgresql_using="gin",
    )
    op.create_index(
        "idx_dynamic_record_search_gin",
        "dynamic_record",
        ["search_vector"],
        postgresql_using="gin",
    )

    # 7. AI_ANALYSIS_LOG
    op.create_table(
        "ai_analysis_log",
        sa.Column("log_id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "config_id",
            sa.BigInteger(),
            sa.ForeignKey("configuration.config_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("raw_input", sa.Text(), nullable=False),
        sa.Column("sanitized_input", sa.Text(), nullable=False),
        sa.Column("ambiguity_flag", sa.Boolean(), server_default="false"),
        sa.Column(
            "timestamp",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("ai_analysis_log")
    op.drop_index("idx_dynamic_record_search_gin", table_name="dynamic_record")
    op.drop_index("idx_dynamic_record_payload_gin", table_name="dynamic_record")
    op.drop_table("dynamic_record")
    op.drop_index("idx_config_module_map_schema_gin", table_name="config_module_map")
    op.drop_table("config_module_map")
    op.drop_table("configuration")
    op.drop_index("idx_available_module_schema_gin", table_name="available_module")
    op.drop_table("available_module")
    op.drop_table("users")
    op.drop_table("tenant_profile")
