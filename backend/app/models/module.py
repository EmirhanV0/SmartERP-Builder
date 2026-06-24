from sqlalchemy import Integer, String, Boolean, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config.database import Base


class AvailableModule(Base):
    __tablename__ = "available_module"

    module_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    module_name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    # Module's default field schema (JSONB)
    base_schema_json: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")
    is_system_default: Mapped[bool] = mapped_column(Boolean, server_default="true")

    # Relationships
    config_mappings: Mapped[list["ConfigModuleMap"]] = relationship(
        "ConfigModuleMap", back_populates="module"
    )

    # GIN index — fast JSONB search
    __table_args__ = (
        Index("idx_available_module_schema_gin", "base_schema_json", postgresql_using="gin"),
    )
