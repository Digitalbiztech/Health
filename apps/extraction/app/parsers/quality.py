"""
Extraction Quality Engine.

Evaluates extraction completeness using three sub-scores:
  1. Coverage score   — found_markers / expected_markers across detected panels
  2. Structural score — fraction of markers with all fields (name, value, unit, range)
  3. Critical score   — fraction of mandatory markers present per panel

Composite confidence = 0.45 × coverage + 0.30 × structural + 0.25 × critical

Used by the pipeline orchestrator to decide whether to accept an extraction
result or escalate to the next extractor.
"""

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass, field

logger = logging.getLogger(__name__)

# ── Panel definitions ─────────────────────────────────────────

PANEL_DEFINITIONS: dict[str, dict[str, list[str]]] = {
    "CBC": {
        "expected": [
            "hemoglobin", "wbc", "rbc", "platelets",
            "hematocrit", "mcv", "mch", "mchc",
        ],
        "critical": ["hemoglobin", "wbc", "rbc", "platelets"],
    },
    "Lipid Panel": {
        "expected": ["total_cholesterol", "ldl", "hdl", "triglycerides", "vldl"],
        "critical": ["total_cholesterol", "ldl", "hdl", "triglycerides"],
    },
    "Kidney": {
        "expected": ["creatinine", "bun", "egfr", "uric_acid"],
        "critical": ["creatinine", "egfr"],
    },
    "Liver": {
        "expected": [
            "alt", "ast", "bilirubin_total", "albumin", "alp",
            "ggt", "total_protein", "globulin",
        ],
        "critical": ["alt", "ast"],
    },
    "Electrolytes": {
        "expected": ["sodium", "potassium", "calcium", "chloride", "magnesium", "phosphorus"],
        "critical": ["sodium", "potassium"],
    },
    "Thyroid": {
        "expected": ["tsh", "t3", "t4", "free_t4", "free_t3"],
        "critical": ["tsh"],
    },
    "Diabetes": {
        "expected": ["fasting_glucose", "hba1c", "random_glucose", "insulin_fasting"],
        "critical": ["fasting_glucose"],
    },
    "Iron Studies": {
        "expected": ["iron", "ferritin"],
        "critical": ["ferritin"],
    },
    "Vitamins": {
        "expected": ["vitamin_d", "vitamin_b12", "folate"],
        "critical": ["vitamin_d"],
    },
    "Inflammation": {
        "expected": ["crp", "esr"],
        "critical": [],
    },
}

# Minimum markers required to consider a panel as "detected" in the report
_MIN_PANEL_HITS = 2

# Coverage weighting. A panel's "expected" list is the *superset* of markers a
# panel can contain, but most real reports only include a subset (a lab rarely
# runs every CBC index). Weighting critical markers fully and optional markers
# partially stops a fully-extracted basic panel from being scored as if half the
# data were missing — which previously dragged confidence to ~0.45 and triggered
# needless OCR escalation.
_CRITICAL_WEIGHT = 1.0
_OPTIONAL_WEIGHT = 0.4


# ── Quality data structure ────────────────────────────────────


@dataclass
class ExtractionQuality:
    """Scored quality assessment for a single extraction attempt."""

    extractor: str
    markers_found: int = 0
    markers_with_values: int = 0
    markers_with_units: int = 0
    markers_with_ranges: int = 0
    coverage_score: float = 0.0
    structural_score: float = 0.0
    critical_marker_score: float = 0.0
    confidence_score: float = 0.0
    detected_panels: list[str] = field(default_factory=list)
    missing_critical: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


# ── Scoring functions ─────────────────────────────────────────


def detect_panels(canonical_names: set[str]) -> list[str]:
    """Infer which clinical panels were screened based on found markers.

    A panel is "detected" if at least ``_MIN_PANEL_HITS`` of its expected
    markers appear in the extraction result.
    """
    detected: list[str] = []
    for panel_name, defn in PANEL_DEFINITIONS.items():
        hits = sum(1 for m in defn["expected"] if m in canonical_names)
        if hits >= min(_MIN_PANEL_HITS, len(defn["expected"])):
            detected.append(panel_name)
    return detected


def compute_coverage(
    canonical_names: set[str],
    detected_panels: list[str],
) -> float:
    """Weighted coverage across detected panels.

    Critical markers contribute full weight; optional markers contribute partial
    weight (a lab legitimately may not report every optional index of a panel).
    This avoids penalizing a complete extraction of a deliberately-small panel.

    Returns 1.0 when no panels are detected (nothing expected → fully covered).
    """
    total_weight = 0.0
    found_weight = 0.0

    for panel_name in detected_panels:
        defn = PANEL_DEFINITIONS.get(panel_name)
        if not defn:
            continue
        critical = set(defn.get("critical", []))
        for marker in defn["expected"]:
            weight = _CRITICAL_WEIGHT if marker in critical else _OPTIONAL_WEIGHT
            total_weight += weight
            if marker in canonical_names:
                found_weight += weight

    if total_weight == 0:
        return 1.0
    return round(min(1.0, found_weight / total_weight), 4)


def compute_structural_score(biomarkers: list[dict]) -> float:
    """Fraction of biomarkers that have all four fields populated.

    Fields checked: name (canonical_name), value, unit, reference_range.
    """
    if not biomarkers:
        return 0.0

    complete = 0
    for b in biomarkers:
        has_name = bool(b.get("canonical_name") or b.get("display_name"))
        has_value = b.get("value") not in (None, "", "0")
        has_unit = bool(b.get("unit"))
        has_range = bool(b.get("reference_range"))
        if has_name and has_value and has_unit and has_range:
            complete += 1

    return round(complete / len(biomarkers), 4)


def compute_critical_score(
    canonical_names: set[str],
    detected_panels: list[str],
) -> tuple[float, list[str]]:
    """Fraction of critical markers present across detected panels.

    Returns (score, missing_critical_list).
    Score is 1.0 when there are no critical markers expected.
    """
    total_critical = 0
    found_critical = 0
    missing: list[str] = []

    for panel_name in detected_panels:
        defn = PANEL_DEFINITIONS.get(panel_name)
        if not defn:
            continue
        for marker in defn["critical"]:
            total_critical += 1
            if marker in canonical_names:
                found_critical += 1
            else:
                missing.append(marker)

    if total_critical == 0:
        return 1.0, []
    return round(found_critical / total_critical, 4), missing


def score_extraction(
    extractor: str,
    normalized_biomarkers: list[dict],
) -> ExtractionQuality:
    """Run the full quality assessment on a set of normalized biomarkers.

    Parameters
    ----------
    extractor : str
        Name of the extractor that produced these results.
    normalized_biomarkers : list[dict]
        Output of ``normalize_batch()`` — each dict has canonical_name,
        value, unit, reference_range, etc.

    Returns
    -------
    ExtractionQuality
        Fully scored quality assessment.
    """
    canonical_names = {
        b["canonical_name"]
        for b in normalized_biomarkers
        if b.get("canonical_name")
    }

    markers_found = len(normalized_biomarkers)
    markers_with_values = sum(
        1 for b in normalized_biomarkers
        if b.get("value") not in (None, "", "0")
    )
    markers_with_units = sum(
        1 for b in normalized_biomarkers if bool(b.get("unit"))
    )
    markers_with_ranges = sum(
        1 for b in normalized_biomarkers if bool(b.get("reference_range"))
    )

    detected_panels = detect_panels(canonical_names)
    coverage = compute_coverage(canonical_names, detected_panels)
    structural = compute_structural_score(normalized_biomarkers)
    critical, missing_critical = compute_critical_score(canonical_names, detected_panels)

    # Weighted composite
    confidence = round(0.45 * coverage + 0.30 * structural + 0.25 * critical, 4)

    quality = ExtractionQuality(
        extractor=extractor,
        markers_found=markers_found,
        markers_with_values=markers_with_values,
        markers_with_units=markers_with_units,
        markers_with_ranges=markers_with_ranges,
        coverage_score=coverage,
        structural_score=structural,
        critical_marker_score=critical,
        confidence_score=confidence,
        detected_panels=detected_panels,
        missing_critical=missing_critical,
    )

    logger.info(
        "Quality [%s]: confidence=%.2f  coverage=%.2f  structural=%.2f  "
        "critical=%.2f  panels=%s  missing=%s  markers=%d",
        extractor,
        confidence,
        coverage,
        structural,
        critical,
        detected_panels,
        missing_critical,
        markers_found,
    )

    return quality


# ── Fallback decision ─────────────────────────────────────────

# Thresholds — tune with real production data
CONFIDENCE_ACCEPT_THRESHOLD = 0.90
CONFIDENCE_ESCALATE_THRESHOLD = 0.75


def should_fallback(quality: ExtractionQuality) -> bool:
    """Return True if the extraction should escalate to the next extractor.

    Triggers fallback when:
      - Confidence score is below the accept threshold (< 0.90)
      - Any critical biomarkers are missing
    """
    if quality.confidence_score < CONFIDENCE_ACCEPT_THRESHOLD:
        logger.info(
            "Fallback triggered [%s]: confidence %.2f < %.2f",
            quality.extractor,
            quality.confidence_score,
            CONFIDENCE_ACCEPT_THRESHOLD,
        )
        return True

    if quality.missing_critical:
        logger.info(
            "Fallback triggered [%s]: missing critical markers %s",
            quality.extractor,
            quality.missing_critical,
        )
        return True

    return False
