"""HTTP routers for the extraction service."""

from .extract import router as extract_router
from .health import router as health_router
from .normalize import router as normalize_router

__all__ = ["extract_router", "health_router", "normalize_router"]
