from fastapi.middleware.cors import CORSMiddleware

# Allowed origins
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]


def add_cors_middleware(app):
    """Adds CORS middleware to the FastAPI application."""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
