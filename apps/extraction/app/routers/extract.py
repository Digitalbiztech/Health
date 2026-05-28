"""
/extract endpoint.

Pipeline for a single PDF:
  1. Download
  2. Extract text (PyMuPDF → pdfplumber → Mistral OCR)
  3. Mask PHI (Presidio + regex)
  4. LLM-parse biomarkers from masked text
  5. Normalize (alias / unit / status)
  6. Generate insights from normalized panel
"""

import logging

from fastapi import APIRouter, HTTPException

from app.extractors import download_file, extract_pdf
from app.models import (
    ExtractedData,
    ExtractionRequest,
    ExtractionResponse,
    Insight,
    NormalizedBiomarker,
    PageText,
    PHIEntityRecord,
    RawBiomarker,
)
from app.parsers import (
    BIOMARKER_DICTIONARY,
    extract_biomarkers_llm,
    generate_insights,
    normalize_batch,
)
from app.phi import mask_pages, mask_text

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/extract", response_model=ExtractionResponse)
async def extract(req: ExtractionRequest) -> ExtractionResponse:
    logger.info("Extraction request for upload %s (%s)", req.upload_id, req.file_type)

    if req.file_type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {req.file_type}. Only application/pdf is supported.",
        )

    try:
        pdf_bytes = await download_file(req.file_url)
        logger.info("Downloaded %d bytes for upload %s", len(pdf_bytes), req.upload_id)

        result = await extract_pdf(pdf_bytes)

        masked_full_text, _, full_entities = mask_text(result["text"])
        masked_page_list, _vault, _page_entities = mask_pages(result["pages"])
        total_phi = len(full_entities)
        logger.info(
            "PHI masking complete for upload %s: %d entities masked",
            req.upload_id,
            total_phi,
        )

        canonical_hints = list(BIOMARKER_DICTIONARY.keys())
        parsed_biomarkers = extract_biomarkers_llm(masked_full_text, canonical_hints)

        normalized = normalize_batch(parsed_biomarkers) if parsed_biomarkers else []
        insight_dicts = generate_insights(normalized) if normalized else []

        return ExtractionResponse(
            success=True,
            upload_id=req.upload_id,
            data=ExtractedData(
                text=result["text"],
                masked_text=masked_full_text,
                method=result["method"],
                confidence=result["confidence"],
                page_count=result["page_count"],
                pages=[PageText(**p) for p in result["pages"]],
                masked_pages=[PageText(**p) for p in masked_page_list],
                phi_entities_count=total_phi,
                phi_entities=[PHIEntityRecord(**e) for e in full_entities],
                metadata=result.get("metadata", {}),
                parsed_biomarkers=[RawBiomarker(**b) for b in parsed_biomarkers],
                normalized_biomarkers=[NormalizedBiomarker(**n) for n in normalized],
                insights=[Insight(**i) for i in insight_dicts],
            ),
        )

    except ValueError as e:
        logger.error("Extraction failed for %s: %s", req.upload_id, e)
        return ExtractionResponse(success=False, upload_id=req.upload_id, error=str(e))

    except Exception as e:
        logger.error("Unexpected error for %s: %s", req.upload_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
