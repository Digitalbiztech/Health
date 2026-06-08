"""
PDF Extraction microservice.

Endpoints:
  POST /extract — full pipeline: download → text extract → PHI mask
                  → LLM biomarker parse → normalize → insights
  GET  /health  — health and dependency status check
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.parsers import BIOMARKER_DICTIONARY, OPENAI_AVAILABLE, OPENAI_MODEL
from app.phi import PRESIDIO_AVAILABLE
from app.routers import extract_router, health_router, normalize_router
from app.rag import rag_router

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
    yield
    logger.info("Extraction service shutting down")


app = FastAPI(
    title="MedicalSaaS Extraction Service",
    version="0.6.0",
    lifespan=lifespan,
)

app.include_router(health_router)
app.include_router(extract_router)
app.include_router(normalize_router)
app.include_router(rag_router)

