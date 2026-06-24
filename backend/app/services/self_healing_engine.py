"""
SelfHealingEngine — Classifies and reports DDL/AI/DELETE failures.
Coordinates AutomatedRecoveryManager (classification) + DiagnosticLogger (persistence).
"""
import logging

from sqlalchemy.ext.asyncio import AsyncEngine

from app.services.automated_recovery_manager import AutomatedRecoveryManager
from app.services.diagnostic_logger import DiagnosticLogger

logger = logging.getLogger(__name__)


class SelfHealingEngine:
    """
    Receives failed operations, determines a recovery action, and writes a log entry.
    report_failure() never raises an exception (DiagnosticLogger is defensive).
    """

    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine
        self._arm = AutomatedRecoveryManager()
        self._logger = DiagnosticLogger(engine)

    async def report_failure(
        self,
        stage: str,
        error: Exception,
        config_id: int | None = None,
        context: str = "",
    ) -> None:
        """
        Classifies the error and writes it to diagnostic_log.
        Defensive: a persistence failure does not break the main flow.

        Args:
            stage:     Failed stage — "DDL" | "AI" | "DELETE"
            error:     The caught exception
            config_id: Related configuration ID (None if unknown)
            context:   Additional context information (for the log message)
        """
        sig = str(error)
        recovery_action = self._arm.classify(sig, stage)

        logger.info(
            "SelfHealingEngine: stage=%s recovery=%s config_id=%s context=%s",
            stage, recovery_action, config_id, context or "–",
        )

        await self._logger.persist(
            stage=stage,
            error_signature=sig,
            recovery_action=recovery_action,
            recovery_status="pending",
            config_id=config_id,
        )

    async def report_recovery(
        self,
        stage: str,
        error: Exception,
        config_id: int | None = None,
        context: str = "",
    ) -> None:
        """
        Records a failure that the system recovered from automatically
        (e.g. a transient 503 that succeeded on retry) with
        recovery_status='auto_resolved'. Defensive like report_failure — never raises.
        """
        sig = str(error)
        recovery_action = self._arm.classify(sig, stage)

        logger.info(
            "SelfHealingEngine: auto-resolved stage=%s recovery=%s config_id=%s context=%s",
            stage, recovery_action, config_id, context or "–",
        )

        await self._logger.persist(
            stage=stage,
            error_signature=sig,
            recovery_action=recovery_action,
            recovery_status="auto_resolved",
            config_id=config_id,
        )

    def attempt_recovery(self, stage: str, error: Exception) -> str:
        """
        Returns the suggested recovery action for an error (sync, no DB).
        Informational only; the actual implementation is left to the caller.
        """
        return self._arm.classify(str(error), stage)
