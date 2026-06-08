"""Request models and shared internal data shapes."""

from pydantic import BaseModel


class ExtractionRequest(BaseModel):
    """Request body from the upstream extraction worker."""

    file_url: str
    file_type: str
    upload_id: str
    patient_id: str | None = None



class PageText(BaseModel):
    """One page worth of extracted (or masked) text."""

    page: int
    text: str


class PHIEntityRecord(BaseModel):
    """One detected PHI entity with its mask token."""

    entity_type: str
    start: int
    end: int
    text: str
    score: float
    source: str
    token: str
    page: int | None = None


class RawBiomarker(BaseModel):
    """Raw biomarker tuple as emitted by the LLM parser."""

    name: str
    value: str | float
    unit: str = ""


class NormalizedBiomarker(BaseModel):
    """Biomarker after alias resolution, unit conversion, and status classification."""

    canonical_name: str
    display_name: str
    value: str
    unit: str
    reference_range: str
    status: str
    category: str
    reference_min: float | None = None
    reference_max: float | None = None
    confidence: float | None = None
    match_method: str | None = None


class Insight(BaseModel):
    """A single LLM-generated clinical insight."""

    id: str
    title: str
    body: str
    tone: str


# ── Normalization-specific request models ─────────────────────


class NormalizationInput(BaseModel):
    """Single biomarker to normalize."""

    name: str
    value: str | float | None = None
    unit: str | None = None


class NormalizationRequest(BaseModel):
    """POST /normalize request body."""

    inputs: list[NormalizationInput]
    min_confidence: float = 0.0


class ResolveRequest(BaseModel):
    """POST /normalize/resolve request body — name-only resolution."""

    names: list[str]
