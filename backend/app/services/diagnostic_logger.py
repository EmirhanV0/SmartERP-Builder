"""
DiagnosticLogger — defensive write layer for the diagnostic_log table.
Must never block the main flow; warns via logging only if an error occurs.
"""
import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

logger = logging.getLogger(__name__)

_MAX_SIG_LEN = 2000


class DiagnosticLogger:
    """
    Inserts into the diagnostic_log table on behalf of SelfHealingEngine.
    All DB errors are caught — persist() never raises an exception.
    """

    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine

    async def persist(
        self,
        stage: str,
        error_signature: str,
        recovery_action: str | None = None,
        recovery_status: str = "pending",
        config_id: int | None = None,
    ) -> None:
        """
        Writes a single record to the diagnostic_log table.
        Any error is swallowed — the main flow is never broken.
        """
        try:
            async with self._engine.begin() as conn:
                await conn.execute(
                    text("""
                        INSERT INTO diagnostic_log
                            (config_id, failure_stage, error_signature,
                             recovery_action, recovery_status)
                        VALUES
                            (:config_id, :stage, :sig, :recovery, :status)
                    """),
                    {
                        "config_id": config_id,
                        "stage":     stage,
                        "sig":       str(error_signature)[:_MAX_SIG_LEN],
                        "recovery":  recovery_action,
                        "status":    recovery_status,
                    },
                )
            logger.debug(
                "DiagnosticLogger: record written stage=%s config_id=%s", stage, config_id
            )
        except Exception as log_exc:
            # Defensive: a logging failure must not propagate to the main flow
            logger.warning("DiagnosticLogger persist error: %s", log_exc)
