"""API response envelopes."""

from pydantic import BaseModel

from .schemas import Insight, NormalizedBiomarker, PageText, PHIEntityRecord, RawBiomarker


class ExtractedData(BaseModel):
    """Structured payload returned for a successful extraction."""

    text: str
    masked_text: str
    method: str
    confidence: float
    page_count: int
    pages: list[PageText]
    masked_pages: list[PageText]
    phi_entities_count: int
    phi_entities: list[PHIEntityRecord] = []
    metadata: dict = {}
    parsed_biomarkers: list[RawBiomarker] = []
    normalized_biomarkers: list[NormalizedBiomarker] = []
    insights: list[Insight] = []
    quality: dict | None = None


class ExtractionResponse(BaseModel):
    """Top-level response wrapper for /extract."""

    success: bool
    upload_id: str
    data: ExtractedData | None = None
    error: str | None = None


class HealthResponse(BaseModel):
    """Response shape for /health."""

    status: str
    service: str
    biomarkers_loaded: int
    presidio_available: bool
    openai_available: bool
    openai_model: str


# ── Normalization responses ───────────────────────────────────


class NormalizationResult(BaseModel):
    """Single normalized biomarker result."""

    input: str
    canonical_name: str | None = None
    display_name: str | None = None
    confidence: float = 0.0
    match_method: str = "none"
    value: str | None = None
    unit: str | None = None
    status: str | None = None
    reference_range: str | None = None
    category: str | None = None
    reference_min: float | None = None
    reference_max: float | None = None


class NormalizationResponse(BaseModel):
    """POST /normalize response."""

    results: list[NormalizationResult]
    matched: int
    unmatched: int


class ResolveResult(BaseModel):
    """Single name resolution result."""

    input: str
    canonical_name: str | None = None
    display_name: str | None = None
    confidence: float = 0.0
    match_method: str = "none"


class ResolveResponse(BaseModel):
    """POST /normalize/resolve response."""

    results: list[ResolveResult]
