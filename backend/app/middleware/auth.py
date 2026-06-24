import uuid
import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config.database import get_db
from app.config.settings import settings
from app.models.user import User
from app.services.auth_service import decode_token

logger = logging.getLogger(__name__)

# tokenUrl = login endpoint, for the "Authorize" button in Swagger UI
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Returns the current user from the JWT token. Raises 401 if invalid."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_token(token)
    if not payload:
        raise credentials_exception

    user_id_str: str = payload.get("sub")
    if not user_id_str:
        raise credentials_exception

    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.user_id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        logger.warning("Token valid but user not found: %s", user_id)
        raise credentials_exception

    return user


async def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Allows access only to users in the ADMIN_EMAILS list.
    The .env list is the source of truth, not the DB role."""
    admin_list = [e.strip().lower() for e in settings.admin_emails.split(",") if e.strip()]
    if current_user.email.lower() not in admin_list:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges are required for this operation",
        )
    return current_user
