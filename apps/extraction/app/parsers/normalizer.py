"""
Biomarker normalization engine.

Multi-strategy name resolution with confidence scoring:
  1. Exact alias index match        → confidence 1.0
  2. Suffix / prefix stripping      → confidence 0.95
  3. Abbreviation match             → confidence 0.90
  4. Token-set similarity           → confidence 0.85
  5. Levenshtein fuzzy match        → confidence 0.75

After resolution: unit conversion → status classification → DB-ready dict.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from decimal import Decimal

from .dictionary import (
    ABBREVIATION_INDEX,
    ALIAS_CANDIDATES,
    ALIAS_INDEX,
    BIOMARKER_DICTIONARY,
)
from .fuzzy import best_fuzzy_match, best_token_set_match

logger = logging.getLogger(__name__)

# Suffixes stripped during fallback name cleaning
_STRIP_SUFFIXES = (" level", " levels", " test", " serum", " plasma", " blood", " total", " count")


@dataclass(frozen=True, slots=True)
class ResolvedName:
    """Result of multi-strategy biomarker name resolution."""

    canonical_name: str
    display_name: str
    confidence: float
    method: str  # exact | suffix_strip | abbreviation | token_set | fuzzy


# ── Resolution strategies ────────────────────────────────────


def _clean(raw: str) -> str:
    """Normalise whitespace, strip non-alnum (except - / .), lowercase."""
    val = raw.replace("_", " ")
    cleaned = re.sub(r"[^a-z0-9\s\-/.]", "", val.lower().strip())
    return re.sub(r"\s+", " ", cleaned).strip()


def _try_exact(cleaned: str) -> ResolvedName | None:
    if cleaned in ALIAS_INDEX:
        canonical = ALIAS_INDEX[cleaned]
        return ResolvedName(
            canonical_name=canonical,
            display_name=BIOMARKER_DICTIONARY[canonical]["display_name"],
            confidence=1.0,
            method="exact",
        )
    return None


def _try_suffix_strip(cleaned: str) -> ResolvedName | None:
    for suffix in _STRIP_SUFFIXES:
        trimmed = cleaned.replace(suffix, "").strip()
        if trimmed and trimmed != cleaned and trimmed in ALIAS_INDEX:
            canonical = ALIAS_INDEX[trimmed]
            return ResolvedName(
                canonical_name=canonical,
                display_name=BIOMARKER_DICTIONARY[canonical]["display_name"],
                confidence=0.95,
                method="suffix_strip",
            )
    return None


def _try_abbreviation(raw: str) -> ResolvedName | None:
    upper = raw.strip().upper()
    if upper in ABBREVIATION_INDEX:
        canonical = ABBREVIATION_INDEX[upper]
        return ResolvedName(
            canonical_name=canonical,
            display_name=BIOMARKER_DICTIONARY[canonical]["display_name"],
            confidence=0.90,
            method="abbreviation",
        )
    # Also try without common noise words
    for noise in ("TEST", "LEVEL", "SERUM", "BLOOD", "PLASMA"):
        trimmed = upper.replace(noise, "").strip()
        if trimmed and trimmed in ABBREVIATION_INDEX:
            canonical = ABBREVIATION_INDEX[trimmed]
            return ResolvedName(
                canonical_name=canonical,
                display_name=BIOMARKER_DICTIONARY[canonical]["display_name"],
                confidence=0.88,
                method="abbreviation",
            )
    return None


def _try_token_set(cleaned: str) -> ResolvedName | None:
    result = best_token_set_match(cleaned, ALIAS_CANDIDATES, threshold=0.65)
    if result:
        canonical, score = result
        return ResolvedName(
            canonical_name=canonical,
            display_name=BIOMARKER_DICTIONARY[canonical]["display_name"],
            confidence=round(min(0.85, 0.6 + score * 0.25), 4),
            method="token_set",
        )
    return None


def _try_fuzzy(cleaned: str) -> ResolvedName | None:
    result = best_fuzzy_match(cleaned, ALIAS_CANDIDATES, threshold=0.75)
    if result:
        canonical, score = result
        return ResolvedName(
            canonical_name=canonical,
            display_name=BIOMARKER_DICTIONARY[canonical]["display_name"],
            confidence=round(min(0.80, 0.5 + score * 0.3), 4),
            method="fuzzy",
        )
    return None


# ── Public API ────────────────────────────────────────────────


def resolve_name(raw_name: str) -> ResolvedName | None:
    """Resolve a free-form biomarker name via cascading strategies.

    Returns a ``ResolvedName`` with confidence and method metadata,
    or ``None`` if no strategy matched.
    """
    cleaned = _clean(raw_name)
    if not cleaned:
        return None

    # Strategy cascade — order matters (highest confidence first)
    for strategy in (_try_exact, _try_suffix_strip):
        result = strategy(cleaned)
        if result:
            return result

    # Abbreviation works on the raw (case-preserving) input
    result = _try_abbreviation(raw_name)
    if result:
        return result

    # Fuzzy strategies as final fallbacks
    for strategy in (_try_token_set, _try_fuzzy):
        result = strategy(cleaned)
        if result:
            return result

    return None


def convert_unit(canonical_name: str, value: float, from_unit: str) -> tuple[float, str]:
    """Convert `value` to the canonical biomarker's preferred unit if possible."""
    entry = BIOMARKER_DICTIONARY.get(canonical_name)
    if not entry:
        return value, from_unit

    preferred = entry["preferred_unit"]
    from_clean = from_unit.strip().lower()
    if from_clean == preferred.strip().lower():
        return value, preferred

    for unit_key, converter in entry.get("unit_conversions", {}).items():
        if unit_key.lower() == from_clean:
            converted = converter(value)
            logger.info(
                "Converted %s: %.4f %s → %.4f %s",
                canonical_name, value, from_unit, converted, preferred,
            )
            return converted, preferred

    logger.warning(
        "No unit conversion for %s: %s → %s", canonical_name, from_unit, preferred,
    )
    return value, from_unit


def classify_status(
    canonical_name: str,
    value: float,
    custom_min: float | None = None,
    custom_max: float | None = None,
) -> str:
    """Classify a value (in preferred unit) as LOW / NORMAL / HIGH / CRITICAL."""
    entry = BIOMARKER_DICTIONARY.get(canonical_name)
    if not entry:
        return "NORMAL"

    ref = entry["reference"]
    crit = entry.get("critical", {})

    ref_min = custom_min if custom_min is not None else ref["min"]
    ref_max = custom_max if custom_max is not None else ref["max"]

    if crit.get("low") is not None and value < crit["low"]:
        return "CRITICAL"
    if crit.get("high") is not None and value > crit["high"]:
        return "CRITICAL"

    if value < ref_min:
        return "LOW"
    if value > ref_max:
        return "HIGH"

    return "NORMAL"


def normalize_biomarker(
    raw_name: str,
    value: float | str,
    unit: str = "",
    source: str = "unknown",
    pdf_ref_min: float | None = None,
    pdf_ref_max: float | None = None,
) -> dict | None:
    """Full normalization for a single biomarker. Returns DB-ready dict or None.

    Parameters
    ----------
    source : str
        Extractor name for auditability ("pymupdf", "pdfplumber", "mistral_ocr").
    pdf_ref_min, pdf_ref_max : float | None
        Reference range extracted from the PDF text. If provided, these take
        priority over the dictionary's built-in reference ranges.
    """
    resolved = resolve_name(raw_name)
    if not resolved:
        logger.warning("Unknown biomarker: '%s'", raw_name)
        return None

    entry = BIOMARKER_DICTIONARY[resolved.canonical_name]

    # Use PDF-extracted range if available, otherwise fall back to dictionary
    ref = entry["reference"]
    ref_min = pdf_ref_min if pdf_ref_min is not None else ref.get("min")
    ref_max = pdf_ref_max if pdf_ref_max is not None else ref.get("max")

    # Try parsing value; if missing/empty, treat as name-only resolution. If invalid string, return None.
    val_str = None
    final_unit = unit or entry["preferred_unit"]
    status = "NORMAL"

    val_stripped = str(value).strip()
    if val_stripped != "":
        try:
            numeric_val = float(val_stripped.replace(",", ""))
            final_value, final_unit = convert_unit(
                resolved.canonical_name, numeric_val, unit or entry["preferred_unit"]
            )
            status = classify_status(resolved.canonical_name, final_value, ref_min, ref_max)
            val_str = str(Decimal(str(round(final_value, 4))))
        except (ValueError, TypeError):
            logger.warning("Cannot parse value '%s' for %s", value, resolved.canonical_name)
            return None

    if pdf_ref_min is not None or pdf_ref_max is not None:
        if pdf_ref_min is not None and pdf_ref_max is not None:
            ref_range_str = f"{pdf_ref_min} - {pdf_ref_max} {final_unit}"
        elif pdf_ref_max is not None:
            ref_range_str = f"< {pdf_ref_max} {final_unit}"
        elif pdf_ref_min is not None:
            ref_range_str = f"> {pdf_ref_min} {final_unit}"
        else:
            ref_range_str = ref.get("range_str", "")
    else:
        ref_range_str = ref.get("range_str", "")

    return {
        "canonical_name": resolved.canonical_name,
        "display_name": resolved.display_name,
        "original_name": raw_name,
        "value": val_str,
        "unit": final_unit,
        "reference_range": ref_range_str,
        "status": status,
        "category": entry.get("category", ""),
        "reference_min": ref_min,
        "reference_max": ref_max,
        "confidence": resolved.confidence,
        "match_method": resolved.method,
        "source": source,
    }


def normalize_batch(
    biomarkers: list[dict],
    min_confidence: float = 0.0,
    source: str = "unknown",
) -> list[dict]:
    """Normalize a batch — unrecognized or invalid value entries are dropped.

    Parameters
    ----------
    biomarkers : list[dict]
        Each dict must have at least ``name``; ``value`` and ``unit`` optional.
        May also include ``reference_min`` and ``reference_max`` from PDF.
    min_confidence : float
        Drop matches below this confidence threshold (0.0–1.0).
    source : str
        Extractor name for auditability.
    """
    results: list[dict] = []
    for raw in biomarkers:
        normalized = normalize_biomarker(
            raw.get("name", ""),
            raw.get("value", ""),
            raw.get("unit", ""),
            source=source,
            pdf_ref_min=raw.get("reference_min"),
            pdf_ref_max=raw.get("reference_max"),
        )
        if normalized is None:
            logger.info("Skipping unrecognized biomarker: %s", raw.get("name", ""))
            continue
        if normalized["value"] is None:
            logger.info("Skipping biomarker with empty/invalid value: %s", raw.get("name", ""))
            continue
        if normalized["confidence"] < min_confidence:
            logger.info(
                "Skipping low-confidence match: %s → %s (%.2f < %.2f)",
                raw.get("name", ""),
                normalized["canonical_name"],
                normalized["confidence"],
                min_confidence,
            )
            continue
        results.append(normalized)

    logger.info("Normalized %d / %d biomarkers", len(results), len(biomarkers))
    return results


def resolve_names_batch(names: list[str]) -> list[dict]:
    """Resolve a list of raw names to canonical names (name-only, no value/unit)."""
    results: list[dict] = []
    for name in names:
        resolved = resolve_name(name)
        if resolved:
            results.append({
                "input": name,
                "canonical_name": resolved.canonical_name,
                "display_name": resolved.display_name,
                "confidence": resolved.confidence,
                "match_method": resolved.method,
            })
        else:
            results.append({
                "input": name,
                "canonical_name": None,
                "display_name": None,
                "confidence": 0.0,
                "match_method": "none",
            })
    return results
