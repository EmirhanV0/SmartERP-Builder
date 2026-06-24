from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database import Base


class DiagnosticLog(Base):
    __tablename__ = "diagnostic_log"

    diag_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    config_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("configuration.config_id", ondelete="SET NULL"),
        nullable=True,
    )
    failure_stage: Mapped[str] = mapped_column(String(50), nullable=False)
    error_signature: Mapped[str] = mapped_column(Text, nullable=False)
    recovery_action: Mapped[str | None] = mapped_column(String(100), nullable=True)
    recovery_status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="pending"
    )
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
