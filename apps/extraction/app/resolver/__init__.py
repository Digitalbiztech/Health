"""Biomarker conflict resolution logic."""

import logging
from typing import Any

logger = logging.getLogger(__name__)

# Fallback priority order for extractors
EXTRACTOR_PRIORITY = ["pymupdf", "pdfplumber", "mistral_ocr"]

def get_priority(extractor: str) -> int:
    """Return priority index for an extractor (lower is higher priority)."""
    normalized = (extractor or "").lower()
    if normalized in EXTRACTOR_PRIORITY:
        return EXTRACTOR_PRIORITY.index(normalized)
    return len(EXTRACTOR_PRIORITY)

def disagree_significantly(val1: str, val2: str) -> bool:
    """Return True if two values differ significantly (e.g. >10% numerically)."""
    if val1 == val2:
        return False
    try:
        f1 = float(val1)
        f2 = float(val2)
        diff = abs(f1 - f2)
        avg = (f1 + f2) / 2.0
        if avg == 0:
            return diff > 1e-4
        return (diff / avg) > 0.10
    except (ValueError, TypeError):
        return True

def resolve_conflicts(group: list[dict]) -> dict:
    """Resolve conflicts between multiple extractions of the same biomarker on the same page.

    Applies the five priority rules to merge metadata and select the best value.
    """
    sources = list({b["extractor"] for b in group})
    
    # Rule 1: check if all values are identical
    unique_values = {b["value"] for b in group if b.get("value") not in (None, "")}
    all_values_identical = len(unique_values) <= 1

    # Initialize merged record with the first candidate
    # We will sort candidates by priority first to make selection easy
    def candidate_sort_key(c: dict) -> tuple:
        # Sort key:
        # 1. Has unit (Rule 3)
        # 2. Has reference range (Rule 4)
        # 3. Extraction confidence (higher first) (Rule 2)
        # 4. Extractor priority (Rule 2)
        has_unit = 1 if c.get("unit") else 0
        has_ref = 1 if c.get("reference_range") else 0
        conf = c.get("confidence") or 0.0
        priority = get_priority(c.get("extractor", ""))
        
        # We want highest confidence, highest priority first
        # python sorts ascending, so we negate confidence and prepend priority
        return (-has_unit, -has_ref, -conf, priority)

    sorted_group = sorted(group, key=candidate_sort_key)
    best_candidate = dict(sorted_group[0])

    # Rule 1: identical values -> boost confidence
    if all_values_identical:
        agreement = True
        requires_review = False
        # Boost confidence slightly
        orig_conf = best_candidate.get("confidence") or 0.8
        best_candidate["confidence"] = min(1.0, orig_conf + 0.05)
        logger.info(
            "Merged identical %s: values agree (value=%s), confidence boosted to %.2f",
            best_candidate["canonical_name"],
            best_candidate["value"],
            best_candidate["confidence"],
        )
    else:
        # We have differing values!
        agreement = False
        
        # Check if values disagree significantly (Rule 5)
        significant_conflict = False
        for c in sorted_group[1:]:
            if disagree_significantly(best_candidate["value"], c["value"]):
                significant_conflict = True
                break
        
        requires_review = significant_conflict
        
        # Log conflict and selection reason
        other_values = [f"{c['extractor']}={c['value']}" for c in sorted_group]
        logger.warning(
            "Conflict detected for %s: %s. Selected value=%s from %s (confidence=%.2f). Requires review: %s",
            best_candidate["canonical_name"],
            ", ".join(other_values),
            best_candidate["value"],
            best_candidate["extractor"],
            best_candidate.get("confidence") or 0.0,
            requires_review,
        )

    # Rule 4: Merge reference range and metadata (never lose information)
    for c in sorted_group[1:]:
        if not best_candidate.get("reference_range") and c.get("reference_range"):
            best_candidate["reference_range"] = c["reference_range"]
            best_candidate["reference_min"] = c.get("reference_min")
            best_candidate["reference_max"] = c.get("reference_max")
        if not best_candidate.get("unit") and c.get("unit"):
            best_candidate["unit"] = c["unit"]
        # Merge other metadata if present
        if "metadata" in c:
            if "metadata" not in best_candidate:
                best_candidate["metadata"] = {}
            best_candidate["metadata"].update(c["metadata"])

    best_candidate["sources"] = sources
    best_candidate["selected_from"] = best_candidate["extractor"]
    best_candidate["agreement"] = agreement
    best_candidate["requires_review"] = requires_review

    return best_candidate
