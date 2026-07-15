"""Health check endpoint."""

from fastapi import APIRouter

from app.models import HealthResponse
from app.parsers import (
    BIOMARKER_DICTIONARY,
    OPENAI_AVAILABLE,
    OPENAI_MODEL,
    MISTRAL_AVAILABLE,
    MISTRAL_MODEL,
)
from app.phi import PRESIDIO_AVAILABLE

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="extraction",
        biomarkers_loaded=len(BIOMARKER_DICTIONARY),
        presidio_available=PRESIDIO_AVAILABLE,
        openai_available=OPENAI_AVAILABLE or MISTRAL_AVAILABLE,
        openai_model=OPENAI_MODEL if OPENAI_AVAILABLE else MISTRAL_MODEL,
        mistral_available=MISTRAL_AVAILABLE,
        mistral_model=MISTRAL_MODEL,
    )
