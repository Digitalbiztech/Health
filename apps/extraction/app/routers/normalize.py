"""
/normalize endpoint.

Standalone biomarker normalization — raw names → canonical JSON.
Does NOT require a PDF upload; works on structured input directly.
"""

import logging

from fastapi import APIRouter

from app.models import (
    NormalizationRequest,
    NormalizationResponse,
    NormalizationResult,
    ResolveRequest,
    ResolveResponse,
    ResolveResult,
)
from app.parsers import normalize_batch, resolve_names_batch

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/normalize", response_model=NormalizationResponse)
async def normalize(req: NormalizationRequest) -> NormalizationResponse:
    """Normalize a batch of raw biomarker inputs to canonical form."""
    logger.info("Normalization request with %d inputs", len(req.inputs))

    raw_dicts = [
        {
            "name": inp.name,
            "value": str(inp.value) if inp.value is not None else "",
            "unit": inp.unit or "",
        }
        for inp in req.inputs
    ]

    normalized = normalize_batch(raw_dicts, min_confidence=req.min_confidence)

    # Build a lookup of canonical results keyed by input name
    norm_by_input: dict[str, dict] = {}
    for inp, norm in zip(raw_dicts, [None] * len(raw_dicts)):
        pass  # placeholder

    # Re-run per-input to preserve 1:1 mapping with unmatched entries
    results: list[NormalizationResult] = []
    matched = 0
    for inp in req.inputs:
        from app.parsers import normalize_biomarker

        norm = normalize_biomarker(
            inp.name,
            str(inp.value) if inp.value is not None else "",
            inp.unit or "",
        )
        if norm and norm.get("confidence", 0) >= req.min_confidence:
            matched += 1
            results.append(
                NormalizationResult(
                    input=inp.name,
                    canonical_name=norm["canonical_name"],
                    display_name=norm["display_name"],
                    confidence=norm["confidence"],
                    match_method=norm["match_method"],
                    value=norm["value"] if inp.value is not None else None,
                    unit=norm["unit"] if inp.value is not None else None,
                    status=norm["status"] if inp.value is not None else None,
                    reference_range=norm["reference_range"],
                    category=norm["category"],
                    reference_min=norm.get("reference_min"),
                    reference_max=norm.get("reference_max"),
                )
            )
        else:
            results.append(
                NormalizationResult(
                    input=inp.name,
                    canonical_name=None,
                    confidence=0.0,
                    match_method="none",
                )
            )

    return NormalizationResponse(
        results=results,
        matched=matched,
        unmatched=len(req.inputs) - matched,
    )


@router.post("/normalize/resolve", response_model=ResolveResponse)
async def resolve(req: ResolveRequest) -> ResolveResponse:
    """Resolve raw biomarker names to canonical names (no value/unit processing)."""
    logger.info("Resolve request with %d names", len(req.names))

    raw_results = resolve_names_batch(req.names)
    results = [ResolveResult(**r) for r in raw_results]

    return ResolveResponse(results=results)
