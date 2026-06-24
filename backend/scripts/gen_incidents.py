"""
Development script — creates 6 incidents via SelfHealingEngine.
Covers all of ARM's decision paths (SQLSTATE_MAP, HTTP_MAP, stage fallback).
No manual INSERT; the SelfHealingEngine -> ARM -> DiagnosticLogger chain runs.
"""
import asyncio
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config.database import engine
from app.services.self_healing_engine import SelfHealingEngine


async def main() -> None:
    she = SelfHealingEngine(engine)

    # -- SCENARIO 1: DDL — PostgreSQL reserved word syntax error
    # SQLSTATE 42601 -> not in SQLSTATE_MAP -> stage fallback -> recovery_action = "rollback"
    await she.report_failure(
        stage="DDL",
        error=RuntimeError(
            'CREATE TABLE failed: syntax error at or near "select" '
            '(PostgreSQL reserved word), sqlstate=42601, '
            "attempted_table=dyn_dev001_select, config_id=None"
        ),
        config_id=None,
        context="reserved-word DDL failure — syntax error stage fallback",
    )
    print("1/6 DDL/rollback logged.")

    # -- SCENARIO 2: AI — Gemini 429 rate limit
    # "429" is in HTTP_MAP -> recovery_action = "retry_fallback_prompt"
    await she.report_failure(
        stage="AI",
        error=RuntimeError(
            "google.api_core.exceptions.ResourceExhausted: 429 Quota exceeded "
            "for quota metric generate_content_free_tier_requests, "
            "retry_after=60s, model=gemini-2.0-flash, input_tokens=1850"
        ),
        config_id=None,
        context="Gemini rate-limit — HTTP 429 retry_fallback_prompt",
    )
    print("2/6 AI/retry_fallback_prompt (429) logged.")

    # -- SCENARIO 3: DELETE — query_canceled (SQLSTATE 57014)
    # "57014" is in SQLSTATE_MAP -> recovery_action = "manual_escalation"
    await she.report_failure(
        stage="DELETE",
        error=RuntimeError(
            "asyncpg.exceptions.QueryCanceledError: canceling statement due to "
            "lock timeout after 30000ms, sqlstate=57014, "
            "attempted_drop=dyn_dev001_orders, fk_referenced_by=dyn_dev001_invoices"
        ),
        config_id=None,
        context="FK/lock-timeout DELETE failure — SQLSTATE 57014 manual_escalation",
    )
    print("3/6 DELETE/manual_escalation logged.")

    # -- SCENARIO 4: DDL — UNIQUE constraint violation (SQLSTATE 23505)
    # "23505" is in SQLSTATE_MAP -> recovery_action = "auto_fix_identifier"
    await she.report_failure(
        stage="DDL",
        error=RuntimeError(
            'duplicate key value violates unique constraint "uq_employee_email", '
            "sqlstate=23505, attempted_table=dyn_dev001_employee, "
            "conflicting_value=ahmet.yilmaz@firma.com"
        ),
        config_id=None,
        context="unique-constraint violation — SQLSTATE 23505 auto_fix_identifier",
    )
    print("4/6 DDL/auto_fix_identifier logged.")

    # -- SCENARIO 5: AI — Gemini 500 server error
    # "500" is in HTTP_MAP -> recovery_action = "manual_escalation"
    await she.report_failure(
        stage="AI",
        error=RuntimeError(
            "Gemini API returned 500 Internal Server Error after 2 retries — "
            "model temporarily unavailable, model=gemini-2.5-flash, "
            "http_status=500, retry_count=2"
        ),
        config_id=None,
        context="Gemini server error — HTTP 500 manual_escalation",
    )
    print("5/6 AI/manual_escalation (500) logged.")

    # -- SCENARIO 6: DDL — serialization failure (SQLSTATE 40001)
    # "40001" is in SQLSTATE_MAP -> recovery_action = "retry_fallback_prompt"
    await she.report_failure(
        stage="DDL",
        error=RuntimeError(
            "could not serialize access due to concurrent update, sqlstate=40001, "
            "attempted_table=dyn_dev001_invoice, concurrent_writers=2, "
            "retry_count=0"
        ),
        config_id=None,
        context="serialization failure — SQLSTATE 40001 retry_fallback_prompt",
    )
    print("6/6 DDL/retry_fallback_prompt logged.")

    await engine.dispose()
    print("\nAll 6 incidents written via SelfHealingEngine -> ARM -> DiagnosticLogger.")


if __name__ == "__main__":
    asyncio.run(main())
