"""
PDF extraction pipeline.

Cascading fallback: PyMuPDF (native text) → pdfplumber (layouts/tables)
→ Mistral OCR (scanned/image PDFs).
"""

import logging

import httpx

from .pymupdf import extract_with_pymupdf, classify_pdf
from .pdfplumber import extract_with_pdfplumber
from .mistral_ocr import extract_with_mistral_ocr

logger = logging.getLogger(__name__)


async def download_file(file_url: str) -> bytes:
    """Fetch a file's bytes over HTTP."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(file_url)
        resp.raise_for_status()
        return resp.content


def _process_candidate(result: dict, method: str) -> dict:
    """Mask PHI, parse biomarkers, normalize and score quality for a candidate."""
    from app.phi import mask_text, mask_pages
    from app.parsers import (
        BIOMARKER_DICTIONARY,
        extract_biomarkers_llm,
        normalize_batch,
        score_extraction,
    )

    # 1. Mask PHI (Presidio + regex fallback)
    masked_text, _, full_entities = mask_text(result["text"])
    masked_pages, _vault, _page_entities = mask_pages(result["pages"])
    total_phi = len(full_entities)

    # 2. LLM Parse biomarkers from masked text
    hints = list(BIOMARKER_DICTIONARY.keys())
    parsed = extract_biomarkers_llm(masked_text, hints)

    # 3. Normalize parsed biomarkers (resolving names/units/status/source)
    normalized = normalize_batch(parsed, source=method) if parsed else []

    # 4. Score quality via Quality Engine
    quality = score_extraction(method, normalized)

    # Assemble complete extraction bundle
    result["masked_text"] = masked_text
    result["masked_pages"] = masked_pages
    result["phi_entities"] = full_entities
    result["phi_entities_count"] = total_phi
    result["parsed_biomarkers"] = parsed
    result["normalized_biomarkers"] = normalized
    result["quality"] = quality

    return result


async def extract_pdf(pdf_bytes: bytes) -> dict:
    """Run the quality-driven cascading extraction pipeline against a PDF byte string.

    Uses both PyMuPDF and pdfplumber first. If they yield identical sets of biomarkers,
    we proceed with PyMuPDF. If the difference is huge, we run Mistral OCR.
    Otherwise, we select the one with the higher quality/confidence score.
    """
    # Classify PDF first
    pdf_type = classify_pdf(pdf_bytes)

    if pdf_type == "image":
        logger.info("PDF classified as IMAGE. Routing directly to Mistral OCR fallback.")
        ocr_result = await extract_with_mistral_ocr(pdf_bytes)
        if not ocr_result:
            raise ValueError("Mistral OCR failed on image-based PDF")
        ocr_candidate = _process_candidate(ocr_result, "mistral_ocr")
        ocr_candidate["metadata"]["api_logs"] = {
            "mistral_ocr": {
                "text": ocr_candidate.get("text", ""),
                "biomarkers": ocr_candidate.get("normalized_biomarkers", []),
            }
        }
        return ocr_candidate

    # 1. Run both PyMuPDF and pdfplumber
    pymupdf_result = extract_with_pymupdf(pdf_bytes)
    pdfplumber_result = extract_with_pdfplumber(pdf_bytes)

    pymupdf_candidate = _process_candidate(pymupdf_result, "pymupdf") if pymupdf_result else None
    pdfplumber_candidate = _process_candidate(pdfplumber_result, "pdfplumber") if pdfplumber_result else None

    # Gather API logs
    api_logs = {}
    if pymupdf_candidate:
        api_logs["pymupdf"] = {
            "text": pymupdf_candidate.get("text", ""),
            "biomarkers": pymupdf_candidate.get("normalized_biomarkers", []),
        }
    if pdfplumber_candidate:
        api_logs["pdfplumber"] = {
            "text": pdfplumber_candidate.get("text", ""),
            "biomarkers": pdfplumber_candidate.get("normalized_biomarkers", []),
        }

    # Compare results if both succeeded
    if pymupdf_candidate and pdfplumber_candidate:
        set_py = {b["canonical_name"] for b in pymupdf_candidate["normalized_biomarkers"]}
        set_pl = {b["canonical_name"] for b in pdfplumber_candidate["normalized_biomarkers"]}

        if set_py == set_pl:
            logger.info("PyMuPDF and pdfplumber extracted identical biomarker sets. Proceeding with PyMuPDF.")
            pymupdf_candidate["metadata"]["api_logs"] = api_logs
            return pymupdf_candidate

        # Calculate symmetric difference
        sym_diff = set_py.symmetric_difference(set_pl)
        union_len = len(set_py.union(set_pl))

        # Check if the difference is huge:
        # - One is empty and the other is not, or
        # - More than 2 biomarkers differ, or
        # - Discrepancy is greater than 20% of the union of biomarkers.
        huge_difference = False
        if (len(set_py) == 0 and len(set_pl) > 0) or (len(set_pl) == 0 and len(set_py) > 0):
            huge_difference = True
        elif len(sym_diff) > 2:
            huge_difference = True
        elif union_len > 0 and (len(sym_diff) / union_len) > 0.2:
            huge_difference = True

        if huge_difference:
            logger.info(
                "Significant discrepancy detected between PyMuPDF (%d markers) and pdfplumber (%d markers). "
                "Symmetric difference: %d. Routing to Mistral OCR.",
                len(set_py),
                len(set_pl),
                len(sym_diff),
            )
            ocr_result = await extract_with_mistral_ocr(pdf_bytes)
            if ocr_result:
                logger.info("Mistral OCR extraction succeeded. Evaluating quality...")
                ocr_candidate = _process_candidate(ocr_result, "mistral_ocr")
                api_logs["mistral_ocr"] = {
                    "text": ocr_candidate.get("text", ""),
                    "biomarkers": ocr_candidate.get("normalized_biomarkers", []),
                }
                ocr_candidate["metadata"]["api_logs"] = api_logs
                return ocr_candidate
            else:
                logger.warning("Mistral OCR failed. Falling back to the best text extractor candidate.")
                best_text = max([pymupdf_candidate, pdfplumber_candidate], key=lambda c: c["quality"].confidence_score)
                best_text["metadata"]["api_logs"] = api_logs
                return best_text
        else:
            logger.info(
                "Slight difference between PyMuPDF and pdfplumber. Selecting highest quality score."
            )
            best_text = max([pymupdf_candidate, pdfplumber_candidate], key=lambda c: c["quality"].confidence_score)
            best_text["metadata"]["api_logs"] = api_logs
            return best_text

    # If only PyMuPDF succeeded
    if pymupdf_candidate and not pdfplumber_candidate:
        logger.info("Only PyMuPDF succeeded. Evaluating quality...")
        from app.parsers import should_fallback
        if not should_fallback(pymupdf_candidate["quality"]):
            pymupdf_candidate["metadata"]["api_logs"] = api_logs
            return pymupdf_candidate
        logger.info("PyMuPDF quality low and pdfplumber failed. Routing to Mistral OCR.")
        ocr_result = await extract_with_mistral_ocr(pdf_bytes)
        if ocr_result:
            ocr_candidate = _process_candidate(ocr_result, "mistral_ocr")
            api_logs["mistral_ocr"] = {
                "text": ocr_candidate.get("text", ""),
                "biomarkers": ocr_candidate.get("normalized_biomarkers", []),
            }
            ocr_candidate["metadata"]["api_logs"] = api_logs
            return ocr_candidate
        pymupdf_candidate["metadata"]["api_logs"] = api_logs
        return pymupdf_candidate

    # If only pdfplumber succeeded
    if pdfplumber_candidate and not pymupdf_candidate:
        logger.info("Only pdfplumber succeeded. Evaluating quality...")
        from app.parsers import should_fallback
        if not should_fallback(pdfplumber_candidate["quality"]):
            pdfplumber_candidate["metadata"]["api_logs"] = api_logs
            return pdfplumber_candidate
        logger.info("pdfplumber quality low and PyMuPDF failed. Routing to Mistral OCR.")
        ocr_result = await extract_with_mistral_ocr(pdf_bytes)
        if ocr_result:
            ocr_candidate = _process_candidate(ocr_result, "mistral_ocr")
            api_logs["mistral_ocr"] = {
                "text": ocr_candidate.get("text", ""),
                "biomarkers": ocr_candidate.get("normalized_biomarkers", []),
            }
            ocr_candidate["metadata"]["api_logs"] = api_logs
            return ocr_candidate
        pdfplumber_candidate["metadata"]["api_logs"] = api_logs
        return pdfplumber_candidate

    # If both failed, route to Mistral OCR
    logger.info("Both PyMuPDF and pdfplumber failed. Routing to Mistral OCR.")
    ocr_result = await extract_with_mistral_ocr(pdf_bytes)
    if ocr_result:
        ocr_candidate = _process_candidate(ocr_result, "mistral_ocr")
        api_logs["mistral_ocr"] = {
            "text": ocr_candidate.get("text", ""),
            "biomarkers": ocr_candidate.get("normalized_biomarkers", []),
        }
        ocr_candidate["metadata"]["api_logs"] = api_logs
        return ocr_candidate

    raise ValueError("All extraction methods failed — file may be corrupt or empty")


__all__ = [
    "download_file",
    "extract_pdf",
    "extract_with_pymupdf",
    "extract_with_pdfplumber",
    "extract_with_mistral_ocr",
]

