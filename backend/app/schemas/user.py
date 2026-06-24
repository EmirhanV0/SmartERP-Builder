import re
from pydantic import BaseModel, Field, field_validator


class FullNameUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)

    @field_validator("new_password")
    @classmethod
    def password_complexity(cls, v: str) -> str:
        if not re.search(r"[A-Za-z]", v):
            raise ValueError("Password must contain at least one letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one number")
        return v


class UserStatsResponse(BaseModel):
    total_configurations: int
    total_modules: int
    total_records: int
    member_since: str
    records_last_7_days: list[int]
