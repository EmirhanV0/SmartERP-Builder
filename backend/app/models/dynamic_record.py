import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, Text, Boolean, func
from sqlalchemy.dialects.postgresql import UUID, JSONB, TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config.database import Base

if TYPE_CHECKING:
    # Imported only for type checking; SQLAlchemy resolves these by name at runtime.
    from app.models.configuration import ConfigModuleMap, Configuration
    from app.models.user import User


class DynamicRecord(Base):
    __tablename__ = "dynamic_record"

    record_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    map_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("config_module_map.map_id"), nullable=False
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False
    )
    # Dynamic data is stored as JSONB
    data_payload: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")
    # For full-text search (populated via trigger in Stage 5)
    search_vector: Mapped[str | None] = mapped_column(TSVECTOR, nullable=True)
    # Soft delete: flag instead of physical deletion
    is_deleted: Mapped[bool] = mapped_column(Boolean, server_default="false", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    module_map: Mapped["ConfigModuleMap"] = relationship(
        "ConfigModuleMap", back_populates="dynamic_records"
    )
    creator: Mapped["User"] = relationship("User", back_populates="dynamic_records")

    # GIN indexes
    __table_args__ = (
        Index("idx_dynamic_record_payload_gin", "data_payload", postgresql_using="gin"),
        Index("idx_dynamic_record_search_gin", "search_vector", postgresql_using="gin"),
    )


class AIAnalysisLog(Base):
    __tablename__ = "ai_analysis_log"

    log_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    config_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("configuration.config_id"), nullable=False
    )
    raw_input: Mapped[str] = mapped_column(Text, nullable=False)
    sanitized_input: Mapped[str] = mapped_column(Text, nullable=False)
    ambiguity_flag: Mapped[bool] = mapped_column(Boolean, server_default="false")
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    configuration: Mapped["Configuration"] = relationship(
        "Configuration", back_populates="ai_logs"
    )
