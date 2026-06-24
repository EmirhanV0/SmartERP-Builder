import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Integer, String, Boolean, Float, ForeignKey, DateTime, Index, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config.database import Base


class Configuration(Base):
    __tablename__ = "configuration"

    config_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenant_profile.tenant_id"), nullable=False
    )
    # draft | pending_approval | approved | active
    status: Mapped[str] = mapped_column(String(50), server_default="draft")
    ai_confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="false")
    config_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    tenant: Mapped["TenantProfile"] = relationship("TenantProfile", back_populates="configurations")
    module_mappings: Mapped[list["ConfigModuleMap"]] = relationship(
        "ConfigModuleMap", back_populates="configuration"
    )
    ai_logs: Mapped[list["AIAnalysisLog"]] = relationship(
        "AIAnalysisLog", back_populates="configuration"
    )


class ConfigModuleMap(Base):
    __tablename__ = "config_module_map"

    map_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    config_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("configuration.config_id"), nullable=False
    )
    module_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("available_module.module_id"), nullable=False
    )
    # Tenant-customized schema (overrides base_schema_json)
    custom_schema_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, server_default="true")

    # Relationships
    configuration: Mapped["Configuration"] = relationship(
        "Configuration", back_populates="module_mappings"
    )
    module: Mapped["AvailableModule"] = relationship(
        "AvailableModule", back_populates="config_mappings"
    )
    dynamic_records: Mapped[list["DynamicRecord"]] = relationship(
        "DynamicRecord", back_populates="module_map"
    )

    # GIN index — custom schema search
    __table_args__ = (
        Index("idx_config_module_map_schema_gin", "custom_schema_json", postgresql_using="gin"),
    )
