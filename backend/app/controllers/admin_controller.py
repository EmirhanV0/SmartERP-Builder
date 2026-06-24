"""
AdminController — Platform-wide statistics and management endpoints.
Stage 11: Admin Panel — Accessible only to users with the "admin" role.

Endpoints:
  GET   /admin/health                              -> System health metrics (real)
  GET   /admin/overview                            -> General statistics
  GET   /admin/users                               -> All users
  GET   /admin/tenants                             -> All tenants
  GET   /admin/configurations                      -> All configurations
  GET   /admin/logs                                -> AI analysis logs
  GET   /admin/diagnostics                         -> Last 7 days of SelfHealingEngine records
  PATCH /admin/diagnostics/{diag_id}/resolve       -> Manual resolution
  GET   /admin/analytics/sector-distribution       -> Sector distribution (donut)
  GET   /admin/analytics/top-tenants               -> Most active tenants (leaderboard)
  GET   /admin/analytics/confidence-distribution   -> AI confidence score histogram
"""
import logging
from datetime import datetime, timedelta, timezone

import psutil

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

from app.config.database import get_db, engine
from app.middleware.auth import require_admin
from app.middleware.request_timing import get_p95, get_request_count_5m
from app.models.user import User
from app.models.tenant import TenantProfile
from app.models.configuration import Configuration
from app.models.dynamic_record import DynamicRecord, AIAnalysisLog

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])


# ---------------------------------------------------------------------------
# GET /admin/health
# ---------------------------------------------------------------------------

def _fmt_uptime(seconds: int) -> str:
    """Converts seconds to '2d 4h 17m' format."""
    d, rem = divmod(seconds, 86400)
    h, rem = divmod(rem, 3600)
    m = rem // 60
    parts = []
    if d:
        parts.append(f"{d}d")
    if h:
        parts.append(f"{h}h")
    parts.append(f"{m}m")
    return " ".join(parts)


def _db_pool_info() -> dict:
    """Returns SQLAlchemy pool metrics. Falls back if access fails."""
    try:
        pool = engine.pool
        size = pool.size()
        checked_out = pool.checkedout()
        max_overflow = getattr(pool, "_max_overflow", 10)
        return {
            "size": size,
            "checked_out": checked_out,
            "max": size + max_overflow,
        }
    except Exception as exc:
        logger.warning("Could not retrieve DB pool metrics: %s", exc)
        return {"size": 0, "checked_out": 0, "max": 0}


@router.get("/health", summary="System health metrics")
async def system_health(
    request: Request,
    current_admin: User = Depends(require_admin),
) -> dict:
    """Real-time system health info: uptime, p95, pool, memory."""
    # Uptime
    startup: datetime = request.app.state.startup_time
    now = datetime.now(timezone.utc)
    uptime_seconds = int((now - startup).total_seconds())

    # API p95 + request count (last 5 min)
    api_p95_ms = int(get_p95())
    req_count_5m = get_request_count_5m()

    # DB pool
    pool_info = _db_pool_info()

    # Memory (psutil)
    try:
        proc = psutil.Process()
        memory_mb = round(proc.memory_info().rss / 1024 / 1024, 1)
    except Exception as exc:
        logger.warning("Could not retrieve memory metric: %s", exc)
        memory_mb = 0.0

    # Determine status
    status = "healthy"
    if api_p95_ms > 1000:
        status = "degraded"
    elif pool_info["max"] > 0 and pool_info["checked_out"] / pool_info["max"] > 0.8:
        status = "degraded"
    elif memory_mb > 1024:
        status = "warning"

    return {
        "status":             status,
        "uptime_seconds":     uptime_seconds,
        "uptime_formatted":   _fmt_uptime(uptime_seconds),
        "api_p95_ms":         api_p95_ms,
        "request_count_5m":   req_count_5m,
        "db_pool":            pool_info,
        "memory_mb":          memory_mb,
        "timestamp":          now.isoformat(),
    }


# ---------------------------------------------------------------------------
# GET /admin/overview
# ---------------------------------------------------------------------------

@router.get("/overview", summary="General platform statistics")
async def overview(
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Platform-wide summary counts and the last 7 days' daily analysis data."""
    total_tenants = await db.scalar(
        select(func.count()).select_from(TenantProfile)
    )
    total_users = await db.scalar(
        select(func.count()).select_from(User)
    )
    total_configs = await db.scalar(
        select(func.count()).select_from(Configuration).where(Configuration.is_active == True)
    )
    total_records = await db.scalar(
        select(func.count()).select_from(DynamicRecord).where(DynamicRecord.is_deleted == False)
    )

    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    recent_analyses = await db.scalar(
        select(func.count()).select_from(AIAnalysisLog).where(
            AIAnalysisLog.timestamp >= seven_days_ago
        )
    )

    # Daily distribution for the chart
    daily_result = await db.execute(
        text("""
            SELECT date_trunc('day', timestamp AT TIME ZONE 'UTC')::date AS day,
                   COUNT(*)::int AS count
            FROM ai_analysis_log
            WHERE timestamp >= :since
            GROUP BY day
            ORDER BY day
        """),
        {"since": seven_days_ago},
    )
    daily_data = [
        {"day": str(row.day), "count": row.count}
        for row in daily_result.fetchall()
    ]

    logger.info("Admin overview fetched — admin=%s", current_admin.email)
    return {
        "total_tenants":      total_tenants or 0,
        "total_users":        total_users or 0,
        "total_configs":      total_configs or 0,
        "total_records":      total_records or 0,
        "recent_analyses_7d": recent_analyses or 0,
        "daily_analyses":     daily_data,
    }


# ---------------------------------------------------------------------------
# GET /admin/users
# ---------------------------------------------------------------------------

@router.get("/users", summary="All users")
async def list_users(
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Returns users across all tenants together with the tenant name."""
    result = await db.execute(
        select(User, TenantProfile.company_name)
        .join(TenantProfile, User.tenant_id == TenantProfile.tenant_id)
        .order_by(User.created_at.desc())
    )
    return [
        {
            "user_id":     str(u.user_id),
            "email":       u.email,
            "full_name":   u.full_name,
            "role":        u.role,
            "tenant_name": tenant_name,
            "created_at":  u.created_at.isoformat(),
        }
        for u, tenant_name in result.all()
    ]


# ---------------------------------------------------------------------------
# GET /admin/tenants
# ---------------------------------------------------------------------------

@router.get("/tenants", summary="All tenants")
async def list_tenants(
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Returns all companies with their user and configuration counts."""
    result = await db.execute(
        text("""
            SELECT
                t.tenant_id::text,
                t.company_name,
                t.sector_code,
                t.created_at,
                COUNT(DISTINCT u.user_id)::int AS user_count,
                COUNT(DISTINCT c.config_id) FILTER (WHERE c.is_active = true)::int AS config_count
            FROM tenant_profile t
            LEFT JOIN users u ON t.tenant_id = u.tenant_id
            LEFT JOIN configuration c ON t.tenant_id = c.tenant_id
            GROUP BY t.tenant_id, t.company_name, t.sector_code, t.created_at
            ORDER BY t.created_at DESC
        """)
    )
    return [
        {
            "tenant_id":    row.tenant_id,
            "company_name": row.company_name,
            "sector_code":  row.sector_code,
            "created_at":   row.created_at.isoformat(),
            "user_count":   row.user_count,
            "config_count": row.config_count,
        }
        for row in result.fetchall()
    ]


# ---------------------------------------------------------------------------
# GET /admin/configurations
# ---------------------------------------------------------------------------

@router.get("/configurations", summary="All configurations")
async def list_configurations(
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Returns all ERP configurations with tenant name and module count."""
    result = await db.execute(
        text("""
            SELECT
                c.config_id,
                c.status,
                c.ai_confidence_score,
                c.is_active,
                c.created_at,
                t.company_name AS tenant_name,
                COUNT(m.map_id) FILTER (WHERE m.is_enabled = true)::int AS module_count
            FROM configuration c
            JOIN tenant_profile t ON c.tenant_id = t.tenant_id
            LEFT JOIN config_module_map m ON c.config_id = m.config_id
            GROUP BY c.config_id, c.status, c.ai_confidence_score,
                     c.is_active, c.created_at, t.company_name
            ORDER BY c.created_at DESC
        """)
    )
    return [
        {
            "config_id":          row.config_id,
            "tenant_name":        row.tenant_name,
            "status":             row.status,
            "ai_confidence_score": row.ai_confidence_score,
            "is_active":          row.is_active,
            "module_count":       row.module_count,
            "created_at":         row.created_at.isoformat(),
        }
        for row in result.fetchall()
    ]


# ---------------------------------------------------------------------------
# GET /admin/logs
# ---------------------------------------------------------------------------

@router.get("/logs", summary="AI analysis logs")
async def list_logs(
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Returns AI analysis logs newest-first, with tenant name."""
    result = await db.execute(
        text("""
            SELECT
                l.log_id,
                l.raw_input,
                l.ambiguity_flag,
                l.timestamp,
                t.company_name AS tenant_name
            FROM ai_analysis_log l
            JOIN configuration c ON l.config_id = c.config_id
            JOIN tenant_profile t ON c.tenant_id = t.tenant_id
            ORDER BY l.timestamp DESC
            LIMIT 200
        """)
    )
    return [
        {
            "log_id":         row.log_id,
            "tenant_name":    row.tenant_name,
            "raw_input":      row.raw_input[:150] + "..." if len(row.raw_input) > 150 else row.raw_input,
            "ambiguity_flag": row.ambiguity_flag,
            "timestamp":      row.timestamp.isoformat(),
        }
        for row in result.fetchall()
    ]


# ---------------------------------------------------------------------------
# GET /admin/diagnostics
# ---------------------------------------------------------------------------

@router.get("/diagnostics", summary="SelfHealingEngine diagnostic records")
async def list_diagnostics(
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Returns the last 7 days of diagnostic_log records with tenant name."""
    result = await db.execute(
        text("""
            SELECT
                d.diag_id,
                d.config_id,
                d.failure_stage,
                d.error_signature,
                d.recovery_action,
                d.recovery_status,
                d.occurred_at,
                t.company_name AS tenant_name
            FROM diagnostic_log d
            LEFT JOIN configuration c ON d.config_id = c.config_id
            LEFT JOIN tenant_profile t ON c.tenant_id = t.tenant_id
            WHERE d.occurred_at >= NOW() - INTERVAL '7 days'
            ORDER BY d.occurred_at DESC
            LIMIT 200
        """)
    )
    return [
        {
            "diag_id":         row.diag_id,
            "config_id":       row.config_id,
            "failure_stage":   row.failure_stage,
            "error_signature": row.error_signature,
            "recovery_action": row.recovery_action,
            "recovery_status": row.recovery_status,
            "occurred_at":     row.occurred_at.isoformat(),
            "tenant_name":     row.tenant_name,
        }
        for row in result.fetchall()
    ]


# ---------------------------------------------------------------------------
# PATCH /admin/diagnostics/{diag_id}/resolve
# ---------------------------------------------------------------------------

@router.patch("/diagnostics/{diag_id}/resolve", summary="Manually resolve a diagnostic record")
async def resolve_diagnostic(
    diag_id: int,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Marks the specified diagnostic record as 'manual_resolved'."""
    result = await db.execute(
        text("""
            UPDATE diagnostic_log
            SET recovery_status = 'manual_resolved'
            WHERE diag_id = :diag_id
            RETURNING diag_id, config_id, failure_stage, error_signature,
                      recovery_action, recovery_status, occurred_at
        """),
        {"diag_id": diag_id},
    )
    row = result.fetchone()
    if not row:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Diagnostic record not found: {diag_id}")

    await db.commit()
    logger.info("Diagnostic resolved. diag_id=%d admin=%s", diag_id, current_admin.email)
    return {
        "diag_id":         row.diag_id,
        "config_id":       row.config_id,
        "failure_stage":   row.failure_stage,
        "error_signature": row.error_signature,
        "recovery_action": row.recovery_action,
        "recovery_status": row.recovery_status,
        "occurred_at":     row.occurred_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# GET /admin/analytics/sector-distribution
# ---------------------------------------------------------------------------

@router.get("/analytics/sector-distribution", summary="Sector distribution")
async def sector_distribution(
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Returns the sector distribution of tenants (for the donut chart). Up to 9 sectors + Other."""
    result = await db.execute(
        text("""
            SELECT sector_code, COUNT(*)::int AS count
            FROM tenant_profile
            GROUP BY sector_code
            ORDER BY count DESC
        """)
    )
    rows = result.fetchall()

    # Top 9 + Other bucket
    top = rows[:9]
    other_count = sum(r.count for r in rows[9:])

    data = [{"sector": r.sector_code or "unknown", "count": r.count} for r in top]
    if other_count > 0:
        data.append({"sector": "other", "count": other_count})

    return data


# ---------------------------------------------------------------------------
# GET /admin/analytics/top-tenants
# ---------------------------------------------------------------------------

@router.get("/analytics/top-tenants", summary="Most active tenants")
async def top_tenants(
    limit: int = 5,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Returns the most active tenants by total record count (leaderboard)."""
    result = await db.execute(
        text("""
            SELECT
                t.tenant_id::text,
                t.company_name,
                t.sector_code,
                COUNT(DISTINCT c.config_id) FILTER (WHERE c.is_active = true)::int AS config_count,
                COUNT(dr.record_id) FILTER (WHERE dr.is_deleted = false)::int AS total_records
            FROM tenant_profile t
            LEFT JOIN configuration c ON t.tenant_id = c.tenant_id
            LEFT JOIN config_module_map cmm ON c.config_id = cmm.config_id
            LEFT JOIN dynamic_record dr ON cmm.map_id = dr.map_id AND dr.is_deleted = false
            GROUP BY t.tenant_id, t.company_name, t.sector_code
            ORDER BY total_records DESC, config_count DESC
            LIMIT :limit
        """),
        {"limit": limit},
    )
    return [
        {
            "tenant_id":    row.tenant_id,
            "company_name": row.company_name,
            "sector_code":  row.sector_code,
            "config_count": row.config_count,
            "total_records": row.total_records,
        }
        for row in result.fetchall()
    ]


# ---------------------------------------------------------------------------
# GET /admin/analytics/confidence-distribution
# ---------------------------------------------------------------------------

@router.get("/analytics/confidence-distribution", summary="AI confidence score distribution")
async def confidence_distribution(
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Buckets the last 30 days of Configuration.ai_confidence_score values into 5 buckets."""
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    result = await db.execute(
        text("""
            SELECT
                CASE
                    WHEN ai_confidence_score < 0.6  THEN '< 0.60'
                    WHEN ai_confidence_score < 0.70 THEN '0.60–0.69'
                    WHEN ai_confidence_score < 0.80 THEN '0.70–0.79'
                    WHEN ai_confidence_score < 0.90 THEN '0.80–0.89'
                    ELSE '0.90–1.00'
                END AS bucket,
                COUNT(*)::int AS count
            FROM configuration
            WHERE ai_confidence_score IS NOT NULL
              AND created_at >= :since
            GROUP BY bucket
            ORDER BY bucket
        """),
        {"since": thirty_days_ago},
    )
    rows = result.fetchall()
    # Ensure all 5 buckets present even if count=0
    all_buckets = ['< 0.60', '0.60–0.69', '0.70–0.79', '0.80–0.89', '0.90–1.00']
    counts = {r.bucket: r.count for r in rows}
    return [{"bucket": b, "count": counts.get(b, 0)} for b in all_buckets]
