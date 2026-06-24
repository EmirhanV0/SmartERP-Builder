"""
Seed script — loads development environment test data into the diagnostic_log table.
Adds 6 sample records representing realistic incident scenarios.

Usage:
    docker-compose exec backend python -m scripts.seed_diagnostics

WARNING: Development environment only. Must not leak into production.
"""
import asyncio
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

logging.basicConfig(level=logging.INFO, format="%(levelname)s — %(message)s")
logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL", "")

# 6 sample diagnostic records — different stages, different recovery statuses
SEED_RECORDS = [
    {
        "config_id":       None,
        "failure_stage":   "AI",
        "error_signature": "google.api_core.exceptions.DeadlineExceeded: 504 Deadline Exceeded "
                           "calling gemini-2.0-flash generate_content, tenant_sector=healthcare, "
                           "input_length=487 chars",
        "recovery_action": "retry_fallback_prompt",
        "recovery_status": "pending",
        "occurred_at":     "NOW() - INTERVAL '5 days'",
    },
    {
        "config_id":       None,
        "failure_stage":   "DDL",
        "error_signature": 'sqlalchemy.exc.ProgrammingError: (asyncpg.exceptions.DuplicateColumnError) '
                           'column "status" of relation "dyn_abc123_inventory" already exists, '
                           "config_id=42, module=inventory",
        "recovery_action": "auto_fix_identifier",
        "recovery_status": "auto_resolved",
        "occurred_at":     "NOW() - INTERVAL '4 days'",
    },
    {
        "config_id":       None,
        "failure_stage":   "DELETE",
        "error_signature": 'sqlalchemy.exc.OperationalError: (asyncpg.exceptions.LockNotAvailableError) '
                           "could not obtain lock on relation \"dyn_def456_sales\", "
                           "config_id=38, 3 of 5 dynamic tables dropped before constraint violation",
        "recovery_action": "manual_escalation",
        "recovery_status": "pending",
        "occurred_at":     "NOW() - INTERVAL '3 days'",
    },
    {
        "config_id":       None,
        "failure_stage":   "AI",
        "error_signature": "json.decoder.JSONDecodeError: Expecting value: line 1 column 1 (char 0). "
                           "Gemini returned non-JSON response for ambiguity resolution, "
                           "tenant_id=ghi789, confidence_score=0.71",
        "recovery_action": "retry_fallback_prompt",
        "recovery_status": "manual_resolved",
        "occurred_at":     "NOW() - INTERVAL '2 days'",
    },
    {
        "config_id":       None,
        "failure_stage":   "DDL",
        "error_signature": 'sqlalchemy.exc.OperationalError: (asyncpg.exceptions.QueryCanceledError) '
                           "canceling statement due to lock timeout after 30000ms, "
                           "config_id=51, alembic migration concurrent connection conflict",
        "recovery_action": "rollback",
        "recovery_status": "auto_resolved",
        "occurred_at":     "NOW() - INTERVAL '1 day'",
    },
    {
        "config_id":       None,
        "failure_stage":   "AI",
        "error_signature": "google.api_core.exceptions.ResourceExhausted: 429 Quota exceeded "
                           "for quota metric 'generate_content_free_tier_requests', "
                           "tenant_id=jkl012, retry_after=60s",
        "recovery_action": "retry_fallback_prompt",
        "recovery_status": "pending",
        "occurred_at":     "NOW() - INTERVAL '6 hours'",
    },
]


async def seed() -> None:
    if not DATABASE_URL:
        logger.error("DATABASE_URL environment variable is not defined.")
        sys.exit(1)

    engine = create_async_engine(DATABASE_URL, echo=False)

    async with engine.begin() as conn:
        inserted = 0
        for rec in SEED_RECORDS:
            await conn.execute(
                text(f"""
                    INSERT INTO diagnostic_log
                        (config_id, failure_stage, error_signature,
                         recovery_action, recovery_status, occurred_at)
                    VALUES
                        (:config_id, :stage, :sig, :recovery, :status, {rec['occurred_at']})
                """),
                {
                    "config_id": rec["config_id"],
                    "stage":     rec["failure_stage"],
                    "sig":       rec["error_signature"],
                    "recovery":  rec["recovery_action"],
                    "status":    rec["recovery_status"],
                },
            )
            inserted += 1
            logger.info("Inserted: stage=%-7s status=%s", rec["failure_stage"], rec["recovery_status"])

    await engine.dispose()
    logger.info("Seed complete — %d diagnostic record(s) inserted.", inserted)


if __name__ == "__main__":
    asyncio.run(seed())
