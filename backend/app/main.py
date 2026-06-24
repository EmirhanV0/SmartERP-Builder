import logging
from datetime import datetime, timezone

from fastapi import FastAPI

from app.middleware.cors import add_cors_middleware
from app.middleware.request_timing import RequestTimingMiddleware
from app.controllers import auth_controller, prompt_controller, dynamic_data_controller
from app.controllers import schema_controller, configurations_controller, admin_controller
from app.controllers import user_controller

# Logging configuration
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# FastAPI application
app = FastAPI(
    title="SmartERP Builder API",
    description="AI-powered automatic ERP configuration platform",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Application startup time (for uptime calculation)
app.state.startup_time = datetime.now(timezone.utc)

# CORS middleware (add first, then timing)
add_cors_middleware(app)

# Request timing middleware
app.add_middleware(RequestTimingMiddleware)

# Register routers
app.include_router(auth_controller.router)
app.include_router(prompt_controller.router)
app.include_router(schema_controller.router)
app.include_router(configurations_controller.router)
app.include_router(dynamic_data_controller.router)
app.include_router(admin_controller.router)
app.include_router(user_controller.router)


@app.get("/", tags=["Health"])
async def root():
    """Service health check."""
    return {"status": "ok", "service": "SmartERP Builder API", "version": "0.1.0"}


@app.get("/health", tags=["Health"])
async def health_check():
    """Detailed health check."""
    return {
        "status": "healthy",
        "database": "not_checked",  # DB check will be added in Stage 2
    }


logger.info("SmartERP Builder API started.")
