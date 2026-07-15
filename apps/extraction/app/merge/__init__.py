"""Biomarker merging logic."""

import logging
from typing import Any
from app.resolver import resolve_conflicts

logger = logging.getLogger(__name__)

def is_similar_value(val1: str, val2: str) -> bool:
    """Check if two biomarker values are numerically or textually similar."""
    if val1 == val2:
        return True
    try:
        f1 = float(val1)
        f2 = float(val2)
        # If both are numeric, check if they are within 5% or 1 unit of each other
        diff = abs(f1 - f2)
        avg = (f1 + f2) / 2.0
        if avg == 0:
            return diff < 1e-4
        return (diff / avg) <= 0.05 or diff <= 1.0
    except (ValueError, TypeError):
        return False

def merge_biomarkers(extractor_results: list[list[dict]]) -> list[dict]:
    """Merge biomarker lists from multiple extractors.

    Performs duplicate detection and conflict resolution across all candidates.
    """
    merged_map: dict[str, list[dict]] = {}

    for result_list in extractor_results:
        for b in result_list:
            canonical = b["canonical_name"]
            page = b.get("page")
            
            # Key by canonical name and page to group duplicates/conflicts
            key = f"{canonical}_page_{page}"
            if key not in merged_map:
                merged_map[key] = []
            merged_map[key].append(b)

    final_biomarkers: list[dict] = []

    for key, group in merged_map.items():
        if len(group) == 1:
            # Only one extractor found this biomarker on this page
            b = dict(group[0])
            b["sources"] = [b["extractor"]]
            b["selected_from"] = b["extractor"]
            b["agreement"] = True
            b["requires_review"] = False
            final_biomarkers.append(b)
        else:
            # Multiple extractors found the same biomarker on this page
            resolved = resolve_conflicts(group)
            final_biomarkers.append(resolved)

    return final_biomarkers
