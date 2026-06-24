import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, ConfigDict


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, description="At least 8 characters")
    full_name: str = Field(min_length=2, description="Full name")
    # The tenant is also created during registration
    company_name: str = Field(min_length=2, description="Company name")
    sector_code: str = Field(min_length=2, description="Sector code (e.g.: retail, manufacturing)")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    user_id: uuid.UUID
    email: str
    full_name: str
    role: str
    tenant_id: uuid.UUID
    created_at: datetime

    # Allows direct construction from a SQLAlchemy model
    model_config = ConfigDict(from_attributes=True)


class UserProfileResponse(BaseModel):
    """GET /auth/me — returns user + tenant information together."""
    user_id: uuid.UUID
    email: str
    full_name: str
    role: str
    tenant_id: uuid.UUID
    created_at: datetime
    company_name: str
    sector_code: str

    model_config = ConfigDict(from_attributes=False)


class TenantResponse(BaseModel):
    tenant_id: uuid.UUID
    company_name: str
    sector_code: str
    subscription_plan: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
