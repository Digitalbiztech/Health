"""Service-to-service authentication.

The extraction service sits behind the Node gateway and must not be callable
directly by clients. When ``EXTRACTION_SERVICE_SECRET`` is configured, every
protected request must carry a matching ``X-Service-Secret`` header. When the
secret is unset (local dev), requests are allowed but a warning is logged once.
"""
import hmac
import logging

from fastapi import Header, HTTPException, status

from app.rag.config import SERVICE_SECRET

logger = logging.getLogger(__name__)

_warned = False


async def require_service_secret(x_service_secret: str | None = Header(default=None)) -> None:
    """FastAPI dependency enforcing the shared service secret."""
    global _warned
    if not SERVICE_SECRET:
        if not _warned:
            logger.warning(
                "EXTRACTION_SERVICE_SECRET is not set — service auth is DISABLED. "
                "Set it in production to prevent direct access to PHI endpoints."
            )
            _warned = True
        return

    # Constant-time comparison; reject missing or mismatched secrets.
    if not x_service_secret or not hmac.compare_digest(x_service_secret, SERVICE_SECRET):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing service credentials.",
        )
