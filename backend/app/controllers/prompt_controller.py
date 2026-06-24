"""
PromptController — AI analysis endpoints.
Stage 4: AI Integration

Endpoints:
  POST /prompt/analyze          -> Analyze the business description with Gemini
  POST /prompt/analyze/clarify  -> Re-analyze with clarification answers
  GET  /prompt/logs             -> User's analysis history
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config.database import get_db, engine
from app.config.settings import settings
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.configuration import Configuration
from app.models.dynamic_record import AIAnalysisLog
from app.schemas.prompt import (
    AnalyzeRequest,
    ClarifyRequest,
    AnalysisResponse,
    SchemaProposal,
    ModuleProposal,
)
from app.services.nlp_processor import NLPProcessor
from app.services.benchmark_engine import BenchmarkEngine
from app.services.self_healing_engine import SelfHealingEngine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/prompt", tags=["Prompt & AI Analysis"])

# Service instances (single instance for the app's lifetime)
_nlp = NLPProcessor()
_benchmark = BenchmarkEngine()

# Daily-quota exhaustion markers — retrying is pointless until the quota resets
_QUOTA_MARKERS = ("429", "RESOURCE_EXHAUSTED", "quota")


def _is_quota_error(message: str) -> bool:
    """True if the error message indicates Gemini quota exhaustion (429)."""
    lowered = message.lower()
    return any(marker.lower() in lowered for marker in _QUOTA_MARKERS)


# ---------------------------------------------------------------------------
# Shared analysis helper
# ---------------------------------------------------------------------------

async def _run_analysis(
    user_text: str,
    sector: str,
    current_user: User,
    db: AsyncSession,
) -> AnalysisResponse:
    """
    Full analysis flow:
      1. Sanitize text
      2. Gemini API call
      3. Configuration + AIAnalysisLog DB records
      4. confidence < 0.85 -> ambiguity response
      5. confidence >= 0.85 -> BenchmarkEngine + SchemaProposal
    """
    sanitized = _nlp.sanitize(user_text)

    # --- Gemini API ---
    # Shared healer: analyze() writes auto_resolved records on successful retries,
    # the except blocks below write pending records when the request finally fails
    healing = SelfHealingEngine(engine)
    try:
        ai_result = await _nlp.analyze(user_text, sector, healer=healing)
    except ValueError as exc:
        await healing.report_failure(
            stage="AI",
            error=exc,
            config_id=None,
            context=f"sector={sector} model={settings.gemini_model} reason=json_parse",
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"AI response parse error: {exc}",
        ) from exc
    except RuntimeError as exc:
        # retry_count / retries_exhausted are attached by _call_gemini_with_retry
        retry_count = getattr(exc, "retry_count", 1)
        retries_exhausted = getattr(exc, "retries_exhausted", False)
        await healing.report_failure(
            stage="AI",
            error=exc,
            config_id=None,
            context=(
                f"sector={sector} model={settings.gemini_model} reason=connection "
                f"retry_count={retry_count} retries_exhausted={retries_exhausted}"
            ),
        )
        # Quota exhaustion gets a user-actionable message — retrying won't help
        if _is_quota_error(str(exc)):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI service daily quota reached. Please try again later.",
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    confidence: float = float(ai_result.get("confidence_score", 0.0))
    ambiguity_flag: bool = confidence < 0.85

    # --- Configuration record (draft) ---
    config = Configuration(
        tenant_id=current_user.tenant_id,
        status="draft",
        ai_confidence_score=confidence,
        is_active=False,
    )
    db.add(config)
    await db.flush()  # to obtain the config_id PK

    # --- AI analysis log ---
    log = AIAnalysisLog(
        config_id=config.config_id,
        raw_input=user_text,
        sanitized_input=sanitized,
        ambiguity_flag=ambiguity_flag,
    )
    db.add(log)
    await db.commit()
    await db.refresh(config)
    await db.refresh(log)

    logger.info(
        "Analysis saved. config_id=%s log_id=%s confidence=%.2f ambiguity=%s",
        config.config_id,
        log.log_id,
        confidence,
        ambiguity_flag,
    )

    # --- Benchmark + SchemaProposal ---
    # Built for the ambiguous case too: the user can review the best-guess
    # proposal on the preview page and either clarify or approve it as-is
    enriched = await _benchmark.match_and_enrich(
        ai_recommended=ai_result.get("recommended_modules", []),
        sector_code=sector,
        db=db,
    )

    response_status = "needs_clarification" if ambiguity_flag else "ready_for_approval"

    schema_proposal = SchemaProposal(
        entities=ai_result.get("entities", []),
        fields=ai_result.get("fields", {}),
        relationships=ai_result.get("relationships", []),
        recommended_modules=[ModuleProposal(**m) for m in enriched],
        confidence_score=confidence,
        status=response_status,
        suggested_name=ai_result.get("suggested_name"),
    )

    return AnalysisResponse(
        status=response_status,
        confidence_score=confidence,
        raw_input=user_text,
        sanitized_input=sanitized,
        ambiguity_questions=ai_result.get("ambiguity_questions", []) if ambiguity_flag else None,
        schema_proposal=schema_proposal,
        log_id=log.log_id,
        config_id=config.config_id,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/analyze",
    response_model=AnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyze the business description with AI",
    description=(
        "Analyzes the natural language business description with Gemini 2.0 Flash.\n\n"
        "- **confidence >= 0.85** -> `schema_proposal` is populated, `status = ready_for_approval`\n"
        "- **confidence < 0.85**  -> `ambiguity_questions` is populated, `status = needs_clarification`\n\n"
        "Every analysis is recorded in the `AI_ANALYSIS_LOG` table."
    ),
)
async def analyze(
    request: AnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AnalysisResponse:
    """JWT protected — requires Authorization: Bearer <token> header."""
    logger.info(
        "Analysis request. user_id=%s tenant_id=%s sector=%s",
        current_user.user_id,
        current_user.tenant_id,
        request.sector,
    )
    return await _run_analysis(request.text, request.sector, current_user, db)


@router.post(
    "/analyze/clarify",
    response_model=AnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Re-analyze with clarification answers",
    description=(
        "Appends the answers given to the `ambiguity_questions` returned by the previous "
        "`/analyze` call to the original text and resubmits it to Gemini.\n\n"
        "The `answers` field must be in `{question: answer}` format."
    ),
)
async def clarify(
    request: ClarifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AnalysisResponse:
    """JWT protected — re-analysis enriched with clarification answers."""
    logger.info("Clarify request. user_id=%s", current_user.user_id)

    # Append the answers to the original text as an enrichment
    clarification_block = "\n".join(
        f"- {question}: {answer}"
        for question, answer in request.answers.items()
    )
    enriched_text = (
        f"{request.original_text}\n\n"
        f"Additional notes:\n{clarification_block}"
    )

    return await _run_analysis(enriched_text, request.sector, current_user, db)


@router.get(
    "/logs",
    summary="User's analysis history",
    description="Returns the AI analysis logs belonging to the logged-in user's tenant.",
)
async def get_logs(
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """JWT protected — lists the most recent analysis logs."""
    # Find the configuration IDs belonging to the tenant
    config_result = await db.execute(
        select(Configuration.config_id)
        .where(Configuration.tenant_id == current_user.tenant_id)
        .order_by(Configuration.created_at.desc())
        .limit(limit)
    )
    config_ids = [row[0] for row in config_result.fetchall()]

    if not config_ids:
        return []

    # Fetch the logs belonging to these configs
    log_result = await db.execute(
        select(AIAnalysisLog)
        .where(AIAnalysisLog.config_id.in_(config_ids))
        .order_by(AIAnalysisLog.timestamp.desc())
        .limit(limit)
    )
    logs = log_result.scalars().all()

    return [
        {
            "log_id": log.log_id,
            "config_id": log.config_id,
            "sanitized_input": log.sanitized_input,
            "ambiguity_flag": log.ambiguity_flag,
            "timestamp": log.timestamp.isoformat(),
        }
        for log in logs
    ]
