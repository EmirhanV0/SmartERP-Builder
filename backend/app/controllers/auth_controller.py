import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config.database import get_db
from app.config.settings import settings
from app.models.tenant import TenantProfile
from app.models.user import User
from app.schemas.auth import RegisterRequest, TokenResponse, UserResponse, UserProfileResponse
from app.services.auth_service import hash_password, verify_password, create_access_token
from app.middleware.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user and tenant",
)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Creates a new tenant (company) and admin user.
    - The first user to register automatically gets the **admin** role.
    - Each registration creates a new tenant (multi-tenant architecture).
    """
    # Email uniqueness check
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This email address is already in use",
        )

    # Create tenant
    tenant = TenantProfile(
        tenant_id=uuid.uuid4(),
        company_name=data.company_name,
        sector_code=data.sector_code,
    )
    db.add(tenant)
    # Flush to generate tenant_id — commit not required
    await db.flush()

    # Emails in ADMIN_EMAILS get super-admin, everyone else gets a normal user role
    admin_list = [e.strip().lower() for e in settings.admin_emails.split(",") if e.strip()]
    role = "admin" if data.email.lower() in admin_list else "user"

    user = User(
        user_id=uuid.uuid4(),
        tenant_id=tenant.tenant_id,
        email=data.email,
        full_name=data.full_name,
        role=role,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    logger.info("New user registered: %s (tenant: %s)", user.email, tenant.tenant_id)
    return user


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Log in — obtain a JWT token",
)
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """
    Logs in with email and password, returns a JWT access token.

    > **Usage in Swagger:** enter your email address in the `username` field.
    """
    # In the OAuth2 form, email arrives as username
    result = await db.execute(select(User).where(User.email == form.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(
        user_id=user.user_id,
        email=user.email,
        role=user.role,
        tenant_id=user.tenant_id,
    )
    logger.info("User logged in: %s", user.email)
    return {"access_token": token, "token_type": "bearer"}


@router.get(
    "/me",
    response_model=UserProfileResponse,
    summary="Current user information",
)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns the profile of the bearer-token-authenticated user along with tenant information."""
    tenant = await db.get(TenantProfile, current_user.tenant_id)
    return UserProfileResponse(
        user_id=current_user.user_id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        tenant_id=current_user.tenant_id,
        created_at=current_user.created_at,
        company_name=tenant.company_name if tenant else "",
        sector_code=tenant.sector_code if tenant else "",
    )
