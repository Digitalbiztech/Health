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


def _enrich_normalized_biomarkers(normalized: list[dict], pages: list[dict], method: str) -> list[dict]:
    """Add page numbers, row indices, bounding box, and extractor method metadata to normalized biomarkers."""
    enriched = []
    for item in normalized:
        biomarker = dict(item)
        orig_name = biomarker.get("original_name") or biomarker.get("display_name", "")
        value_str = biomarker.get("value")

        detected_page = 1
        row_index = None

        # Search page text for page number and row index
        for p in pages:
            p_num = p["page"]
            p_text = p["text"]

            if orig_name.lower() in p_text.lower():
                detected_page = p_num

                # Try to find the line/row index
                lines = p_text.split("\n")
                for line_idx, line in enumerate(lines):
                    if orig_name.lower() in line.lower():
                        row_index = line_idx
                        # If value is also on this line, we found the perfect row
                        if value_str and value_str in line:
                            break
                break

        biomarker["page"] = detected_page
        biomarker["row_index"] = row_index
        biomarker["bbox"] = None
        biomarker["extractor"] = method
        enriched.append(biomarker)
    return enriched


def _select_best(candidates: list[dict]) -> dict:
    """Pick the highest-quality candidate.

    Ranks by quality confidence score, tie-broken by the number of normalized
    biomarkers (a richer extraction wins an otherwise-even score).
    """
    return max(
        candidates,
        key=lambda c: (
            c["quality"].confidence_score,
            len(c["normalized_biomarkers"]),
        ),
    )


async def extract_pdf(pdf_bytes: bytes) -> dict:
    """Run the merge-first extraction pipeline against a PDF byte string.

    Runs PyMuPDF + pdfplumber + OCR (conditionally/fallback) and merges their outputs.
    """
    from app.merge import merge_biomarkers
    from app.quality import score_merged_extraction

    # Classify PDF first
    pdf_type = classify_pdf(pdf_bytes)

    candidates = []
    ocr_candidate = None
    pymupdf_candidate = None
    pdfplumber_candidate = None

    if pdf_type == "image":
        logger.info("PDF classified as IMAGE. Routing directly to Mistral OCR.")
        ocr_result = await extract_with_mistral_ocr(pdf_bytes)
        if not ocr_result:
            raise ValueError("Mistral OCR failed on image-based PDF")
        ocr_candidate = _process_candidate(ocr_result, "mistral_ocr")
        candidates.append(ocr_candidate)
    else:
        # 1. Run both PyMuPDF and pdfplumber
        pymupdf_result = extract_with_pymupdf(pdf_bytes)
        pdfplumber_result = extract_with_pdfplumber(pdf_bytes)

        if pymupdf_result:
            pymupdf_candidate = _process_candidate(pymupdf_result, "pymupdf")
            candidates.append(pymupdf_candidate)
        if pdfplumber_result:
            pdfplumber_candidate = _process_candidate(pdfplumber_result, "pdfplumber")
            candidates.append(pdfplumber_candidate)

        # Decide if we need OCR fallback for text PDF
        # We run OCR if:
        # - Both text extractors failed
        # - Or there is a significant discrepancy between them
        # - Or one of them succeeded but had low quality
        run_ocr = False
        if not candidates:
            run_ocr = True
        elif len(candidates) == 2:
            set_py = {b["canonical_name"] for b in pymupdf_candidate["normalized_biomarkers"]}
            set_pl = {b["canonical_name"] for b in pdfplumber_candidate["normalized_biomarkers"]}

            if set_py != set_pl:
                sym_diff = set_py.symmetric_difference(set_pl)
                union_len = len(set_py.union(set_pl))

                # Significant discrepancy:
                # - One is empty, other is not
                # - More than 2 biomarkers differ
                # - Discrepancy is > 20% of the union
                if (len(set_py) == 0 or len(set_pl) == 0) or len(sym_diff) > 2 or (union_len > 0 and (len(sym_diff) / union_len) > 0.2):
                    logger.info("Significant discrepancy detected. Running Mistral OCR for a third opinion.")
                    run_ocr = True
        elif len(candidates) == 1:
            # Check if that single candidate has low quality
            from app.parsers import should_fallback
            single_cand = candidates[0]
            if should_fallback(single_cand["quality"]):
                logger.info("Single extractor succeeded but had low quality. Running Mistral OCR.")
                run_ocr = True

        if run_ocr:
            ocr_result = await extract_with_mistral_ocr(pdf_bytes)
            if ocr_result:
                ocr_candidate = _process_candidate(ocr_result, "mistral_ocr")
                candidates.append(ocr_candidate)
            else:
                logger.warning("Mistral OCR failed/skipped.")

    if not candidates:
        raise ValueError("All extraction methods failed — file may be corrupt or empty")

    # 2. Enrich normalized biomarkers with metadata (page, row_index, bbox, extractor)
    candidates_to_merge = []
    api_logs = {}

    for cand in candidates:
        method = cand["method"]
        enriched = _enrich_normalized_biomarkers(
            cand["normalized_biomarkers"],
            cand["pages"],
            method
        )
        candidates_to_merge.append(enriched)

        api_logs[method] = {
            "text": cand.get("text", ""),
            "biomarkers": cand.get("normalized_biomarkers", []),
        }

    # 3. Merge and deduplicate
    merged_biomarkers = merge_biomarkers(candidates_to_merge)

    # Group original biomarkers by canonical_name and page for agreement calculation
    original_groups = []
    group_map = {}
    for lst in candidates_to_merge:
        for b in lst:
            key = (b["canonical_name"], b.get("page"))
            if key not in group_map:
                group_map[key] = []
            group_map[key].append(b)
    original_groups = list(group_map.values())

    # 4. Determine primary candidate to inherit text, pages, phi
    # Order of preference: PyMuPDF > pdfplumber > OCR
    primary_candidate = None
    for method in ["pymupdf", "pdfplumber", "mistral_ocr"]:
        for cand in candidates:
            if cand["method"] == method:
                primary_candidate = cand
                break
        if primary_candidate:
            break
    if not primary_candidate:
        primary_candidate = candidates[0]

    # 5. Score Quality using Redesigned Quality Engine
    quality = score_merged_extraction(
        merged_biomarkers,
        primary_candidate["text"],
        original_groups
    )

    # 6. Build the final response dict
    final_result = {
        "text": primary_candidate["text"],
        "masked_text": primary_candidate["masked_text"],
        "method": "merged" if len(candidates) > 1 else primary_candidate["method"],
        "page_count": primary_candidate["page_count"],
        "pages": primary_candidate["pages"],
        "masked_pages": primary_candidate["masked_pages"],
        "phi_entities": primary_candidate["phi_entities"],
        "phi_entities_count": primary_candidate["phi_entities_count"],
        "parsed_biomarkers": primary_candidate["parsed_biomarkers"],
        "normalized_biomarkers": merged_biomarkers,
        "quality": quality,
        "metadata": dict(primary_candidate.get("metadata", {})),
    }
    final_result["metadata"]["api_logs"] = api_logs

    return final_result


__all__ = [
    "download_file",
    "extract_pdf",
    "extract_with_pymupdf",
    "extract_with_pdfplumber",
    "extract_with_mistral_ocr",
]

