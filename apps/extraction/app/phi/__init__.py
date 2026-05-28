"""PHI detection and masking pipeline."""

import logging

from .presidio import PHIEntity, detect_with_presidio, PRESIDIO_AVAILABLE
from .regex_fallback import detect_with_regex
from .tokenizer import TokenVault, mask_pages, mask_text

logger = logging.getLogger(__name__)


def detect_phi(text: str) -> list[PHIEntity]:
    """Run Presidio + regex detectors and merge, preferring Presidio on overlap."""
    presidio_entities = detect_with_presidio(text)
    regex_entities = detect_with_regex(text)

    merged = list(presidio_entities)
    for regex_ent in regex_entities:
        if not any(
            _spans_overlap(regex_ent.start, regex_ent.end, p.start, p.end)
            for p in presidio_entities
        ):
            merged.append(regex_ent)

    merged.sort(key=lambda e: e.start)
    logger.info(
        "Total PHI entities after merge: %d (presidio=%d, regex-only=%d)",
        len(merged),
        len(presidio_entities),
        len(merged) - len(presidio_entities),
    )
    return merged


def _spans_overlap(s1: int, e1: int, s2: int, e2: int) -> bool:
    return s1 < e2 and s2 < e1


__all__ = [
    "PHIEntity",
    "PRESIDIO_AVAILABLE",
    "TokenVault",
    "detect_phi",
    "detect_with_presidio",
    "detect_with_regex",
    "mask_pages",
    "mask_text",
]
