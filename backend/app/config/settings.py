from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str
    sync_database_url: str = ""

    # Auth
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # AI
    gemini_api_key: str = ""
    gemini_mock: bool = False
    gemini_model: str = "gemini-2.5-flash"

    # Admin: comma-separated list of super-admin emails
    admin_emails: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
