# Import all models so Alembic can see Base.metadata
from app.config.database import Base  # noqa: F401
from app.models.tenant import TenantProfile  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.module import AvailableModule  # noqa: F401
from app.models.configuration import Configuration, ConfigModuleMap  # noqa: F401
from app.models.dynamic_record import DynamicRecord, AIAnalysisLog  # noqa: F401
from app.models.diagnostic_log import DiagnosticLog  # noqa: F401
