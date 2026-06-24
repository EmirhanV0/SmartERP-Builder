import uuid
import logging
from datetime import datetime, timedelta, timezone

import bcrypt as _bcrypt
from jose import jwt, JWTError

from app.config.settings import settings

logger = logging.getLogger(__name__)

# bcrypt is used directly due to a passlib 1.7.4 + bcrypt 4.x incompatibility


def hash_password(password: str) -> str:
    """Hash the password with bcrypt."""
    hashed = _bcrypt.hashpw(password.encode("utf-8"), _bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Compare a plain password with its hash."""
    return _bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(
    user_id: uuid.UUID,
    email: str,
    role: str,
    tenant_id: uuid.UUID,
) -> str:
    """Create a JWT access token."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "tenant_id": str(tenant_id),
        "exp": expire,
    }
    token = jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)
    logger.debug("Token created: user_id=%s, role=%s", user_id, role)
    return token


def decode_token(token: str) -> dict | None:
    """Decode a JWT token. Returns None if invalid or expired."""
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
        return payload
    except JWTError as e:
        logger.warning("Token verification failed: %s", e)
        return None
