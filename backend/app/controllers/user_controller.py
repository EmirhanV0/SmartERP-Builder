"""
UserController — User's own profile and password management.

Endpoints:
  PATCH /users/me                  -> update full_name
  POST  /users/me/change-password  -> change password
  GET   /users/me/stats            -> personal statistics
"""
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.config.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.tenant import TenantProfile
from app.schemas.auth import UserResponse
from app.schemas.user import FullNameUpdate, ChangePasswordRequest, UserStatsResponse
from app.services.auth_service import hash_password, verify_password

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["Users"])


@router.patch(
    "/me",
    response_model=UserResponse,
    summary="Update profile name",
)
async def update_profile(
    data: FullNameUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """JWT protected — only full_name can be updated."""
    current_user.full_name = data.full_name.strip()
    await db.commit()
    await db.refresh(current_user)
    logger.info("Profile updated: %s", current_user.email)
    return current_user


@router.post(
    "/me/change-password",
    summary="Change password",
)
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Verify the current password and store the new bcrypt hash."""
    if not verify_password(data.current_password, current_user.password_hash):
        # Use 400 — 401 triggers the frontend interceptor and redirects to login
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    if data.current_password == data.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password",
        )

    current_user.password_hash = hash_password(data.new_password)
    await db.commit()
    logger.info("Password changed: %s", current_user.email)
    return {"success": True, "message": "Password updated"}


@router.get(
    "/me/stats",
    response_model=UserStatsResponse,
    summary="User statistics",
)
async def get_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserStatsResponse:
    """Configuration/module/record counts and 7-day activity for the tenant."""

    # Same JOIN pattern as the Top Companies endpoint — DynamicRecord is the central table
    stats_result = await db.execute(
        text("""
            SELECT
                COUNT(DISTINCT c.config_id)::int                                          AS total_configurations,
                COUNT(DISTINCT cmm.map_id)::int                                           AS total_modules,
                COUNT(dr.record_id) FILTER (WHERE dr.is_deleted = false)::int             AS total_records
            FROM configuration c
            LEFT JOIN config_module_map cmm ON c.config_id = cmm.config_id AND cmm.is_enabled = true
            LEFT JOIN dynamic_record dr    ON cmm.map_id = dr.map_id AND dr.is_deleted = false
            WHERE c.tenant_id = :tenant_id
        """),
        {"tenant_id": str(current_user.tenant_id)},
    )
    row = stats_result.fetchone()
    total_configurations = row[0] or 0
    total_modules        = row[1] or 0
    total_records        = row[2] or 0

    # Record activity for the last 7 days (top-tenants pattern)
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    daily_result = await db.execute(
        text("""
            SELECT DATE(dr.created_at AT TIME ZONE 'UTC') AS day, COUNT(*)::int AS cnt
            FROM dynamic_record dr
            JOIN config_module_map cmm ON dr.map_id = cmm.map_id
            JOIN configuration c       ON cmm.config_id = c.config_id
            WHERE c.tenant_id = :tenant_id
              AND dr.is_deleted = false
              AND dr.created_at >= :since
            GROUP BY DATE(dr.created_at AT TIME ZONE 'UTC')
            ORDER BY day
        """),
        {"tenant_id": str(current_user.tenant_id), "since": seven_days_ago},
    )
    day_map = {str(r[0]): r[1] for r in daily_result.fetchall()}

    records_last_7_days: list[int] = []
    for i in range(6, -1, -1):
        day = (datetime.now(timezone.utc) - timedelta(days=i)).date()
        records_last_7_days.append(day_map.get(str(day), 0))

    return UserStatsResponse(
        total_configurations=total_configurations,
        total_modules=total_modules,
        total_records=total_records,
        member_since=current_user.created_at.isoformat(),
        records_last_7_days=records_last_7_days,
    )
