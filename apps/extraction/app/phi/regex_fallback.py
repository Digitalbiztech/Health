"""Regex fallback for medical-specific PHI patterns Presidio may miss."""

import logging
import re

from .presidio import PHIEntity

logger = logging.getLogger(__name__)


# (entity_type, pattern, confidence)
REGEX_PATTERNS: list[tuple[str, str, float]] = [
    ("MRN", r"\b(?:MRN|MR#|Med\.?\s*Rec\.?\s*#?)\s*[:.]?\s*(\d{4,12})\b", 0.85),
    ("PATIENT_ID", r"\b(?:Patient\s*ID|PID|Pt\.?\s*ID)\s*[:.]?\s*([A-Z0-9\-]{4,20})\b", 0.85),
    ("DOB", r"\b(?:DOB|D\.O\.B\.?|Date\s+of\s+Birth)\s*[:.]?\s*(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})\b", 0.90),
    ("SSN", r"\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b", 0.80),
    ("AADHAAR", r"\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b", 0.70),
    ("PHONE", r"\b(?:\+?91[\s\-]?)?[6-9]\d{9}\b", 0.85),
    ("PHONE", r"\b(?:\+?1[\s\-]?)?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}\b", 0.85),
    ("EMAIL", r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b", 0.95),
    ("AGE", r"\b(?:Age|Aged?)\s*[:.]?\s*(\d{1,3})\s*(?:years?|yrs?|y/?o)?\b", 0.80),
    (
        "ADDRESS",
        r"\b\d{1,5}\s+(?:[A-Z][a-z]+\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)\b",
        0.70,
    ),
    ("DOCTOR_NAME", r"\b(?:Dr\.?|Doctor)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b", 0.80),
    (
        "PATIENT_NAME",
        r"\b(?:Patient\s*(?:Name)?|Name)\s*[:.]?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b",
        0.80,
    ),
]


def detect_with_regex(text: str) -> list[PHIEntity]:
    """Apply each regex pattern; prefer captured group spans when available."""
    entities: list[PHIEntity] = []

    for entity_type, pattern, confidence in REGEX_PATTERNS:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            if match.lastindex:
                matched_text = match.group(1)
                start, end = match.start(1), match.end(1)
            else:
                matched_text = match.group(0)
                start, end = match.start(0), match.end(0)

            entities.append(
                PHIEntity(
                    entity_type=entity_type,
                    start=start,
                    end=end,
                    text=matched_text,
                    score=confidence,
                    source="regex",
                )
            )

    logger.info("Regex detected %d PHI entities", len(entities))
    return entities
