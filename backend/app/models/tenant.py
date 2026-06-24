import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config.database import Base


class TenantProfile(Base):
    __tablename__ = "tenant_profile"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    sector_code: Mapped[str] = mapped_column(String(100), nullable=False)
    subscription_plan: Mapped[str] = mapped_column(String(50), server_default="free")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    users: Mapped[list["User"]] = relationship("User", back_populates="tenant")
    configurations: Mapped[list["Configuration"]] = relationship(
        "Configuration", back_populates="tenant"
    )
