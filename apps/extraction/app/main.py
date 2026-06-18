"""
PDF Extraction microservice.

Endpoints:
  POST /extract — full pipeline: download → text extract → PHI mask
                  → LLM biomarker parse → normalize → insights
  GET  /health  — health and dependency status check
"""

import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI

from app.parsers import BIOMARKER_DICTIONARY, OPENAI_AVAILABLE, OPENAI_MODEL
from app.phi import PRESIDIO_AVAILABLE
from app.routers import extract_router, health_router, normalize_router
from app.rag import rag_router
from app.rag.config import validate_embedding_dim
from app.security import require_service_secret

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "Extraction service starting up — %d biomarkers loaded, Presidio=%s, OpenAI=%s (model=%s)",
        len(BIOMARKER_DICTIONARY),
        "enabled" if PRESIDIO_AVAILABLE else "disabled (regex fallback)",
        "enabled" if OPENAI_AVAILABLE else "disabled (no OPENAI_API_KEY)",
        OPENAI_MODEL,
    )
    validate_embedding_dim()
    yield
    logger.info("Extraction service shutting down")


app = FastAPI(
    title="MedicalSaaS Extraction Service",
    version="0.6.0",
    lifespan=lifespan,
)

# /health stays open for infrastructure probes; all PHI/processing routers
# require the shared service secret (no-op in dev when the secret is unset).
_service_auth = [Depends(require_service_secret)]
app.include_router(health_router)
app.include_router(extract_router, dependencies=_service_auth)
app.include_router(normalize_router, dependencies=_service_auth)
app.include_router(rag_router, dependencies=_service_auth)

