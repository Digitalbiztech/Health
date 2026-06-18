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

import asyncio
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

        # Retrieve processed data from the quality-driven pipeline result
        masked_full_text = result["masked_text"]
        masked_page_list = result["masked_pages"]
        total_phi = result["phi_entities_count"]
        full_entities = result["phi_entities"]
        parsed_biomarkers = result["parsed_biomarkers"]
        normalized = result["normalized_biomarkers"]
        quality = result["quality"]

        # Generate insights from normalized panel
        insight_dicts = generate_insights(normalized) if normalized else []

        # RAG Ingestion (Non-fatal, patient-scoped)
        if req.patient_id:
            try:
                from app.rag.ingestion import ingest_extraction, parse_report_date
                # Parse the collection/report date from the RAW (unmasked) text —
                # PHI masking strips dates, so this must run before masking is used.
                report_date = parse_report_date(result["text"])
                # Offload the blocking embed + DB work so it doesn't stall the loop.
                await asyncio.to_thread(
                    ingest_extraction,
                    patient_id=req.patient_id,
                    upload_id=req.upload_id,
                    # extraction_id is left unset: the extractions row is created by the
                    # API *after* this service returns, so its id does not exist yet (and
                    # never equals upload_id). Chunks are keyed by upload_id + patient_id,
                    # which is what retrieval filters on.
                    extraction_id=None,
                    masked_text=masked_full_text,
                    biomarkers=normalized,
                    insights=insight_dicts,
                    report_date=report_date,
                )
                logger.info("Successfully ingested extraction into RAG vector store for patient %s", req.patient_id)
            except Exception as re:
                logger.error("RAG Ingestion failed (non-fatal): %s", re, exc_info=True)

        return ExtractionResponse(
            success=True,
            upload_id=req.upload_id,
            data=ExtractedData(
                text=result["text"],
                masked_text=masked_full_text,
                method=result["method"],
                confidence=quality.confidence_score,  # Use quality engine composite confidence
                page_count=result["page_count"],
                pages=[PageText(**p) for p in result["pages"]],
                masked_pages=[PageText(**p) for p in masked_page_list],
                phi_entities_count=total_phi,
                phi_entities=[PHIEntityRecord(**e) for e in full_entities],
                metadata=result.get("metadata", {}),
                parsed_biomarkers=[RawBiomarker(**b) for b in parsed_biomarkers],
                normalized_biomarkers=[NormalizedBiomarker(**n) for n in normalized],
                insights=[Insight(**i) for i in insight_dicts],
                quality=quality.to_dict(),
            ),
        )

    except ValueError as e:
        logger.error("Extraction failed for %s: %s", req.upload_id, e)
        return ExtractionResponse(success=False, upload_id=req.upload_id, error=str(e))

    except Exception as e:
        logger.error("Unexpected error for %s: %s", req.upload_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

