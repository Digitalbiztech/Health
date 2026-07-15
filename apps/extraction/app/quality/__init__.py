"""Extraction Quality scoring engine."""

import logging
from typing import Any
from app.panel_detection import PANEL_DEFINITIONS, infer_panels
from app.validators import validate_clinical_consistency

logger = logging.getLogger(__name__)

# Configurable weights for overall score calculation
QUALITY_WEIGHTS = {
    "completeness": 0.40,
    "extraction_confidence": 0.30,
    "agreement": 0.20,
    "consistency": 0.10,
}

class RedesignedExtractionQuality:
    """Multi-dimensional quality metrics for the extraction pipeline."""

    def __init__(
        self,
        extraction_confidence: float = 0.0,
        completeness_score: float = 0.0,
        agreement_score: float = 0.0,
        consistency_score: float = 0.0,
        overall_score: float = 0.0,
        detected_panels: list[str] = None,
        missing_critical: list[str] = None,
        issues: list[str] = None,
    ):
        self.extraction_confidence = extraction_confidence
        self.completeness_score = completeness_score
        self.agreement_score = agreement_score
        self.consistency_score = consistency_score
        self.overall_score = overall_score
        self.confidence_score = overall_score  # Backward compatibility
        self.detected_panels = detected_panels or []
        self.missing_critical = missing_critical or []
        self.issues = issues or []

    def to_dict(self) -> dict:
        return {
            "extraction_confidence": self.extraction_confidence,
            "completeness_score": self.completeness_score,
            "agreement_score": self.agreement_score,
            "consistency_score": self.consistency_score,
            "overall_score": self.overall_score,
            "detected_panels": self.detected_panels,
            "missing_critical": self.missing_critical,
            "issues": self.issues,
            # Backward compatibility fields
            "confidence_score": self.overall_score,
            "coverage_score": self.completeness_score,
            "structural_score": self.extraction_confidence,
            "critical_marker_score": self.consistency_score,
        }

def compute_biomarker_agreement(biomarker_group: list[dict]) -> float:
    """Calculate agreement score (0.0 to 1.0) for a single biomarker group."""
    values = [b.get("value") for b in biomarker_group if b.get("value") not in (None, "")]
    if len(values) <= 1:
        return 1.0

    # Try converting values to float
    floats = []
    for v in values:
        try:
            floats.append(float(v))
        except (ValueError, TypeError):
            pass

    if len(floats) != len(values):
        # Fallback to string agreement
        return 1.0 if len(set(values)) == 1 else 0.5

    # Numeric agreement: 1.0 - (max_diff / average)
    avg = sum(floats) / len(floats)
    if avg == 0:
        return 1.0
    max_diff = max(floats) - min(floats)
    return max(0.0, round(1.0 - (max_diff / avg), 4))

def score_merged_extraction(
    merged_biomarkers: list[dict],
    raw_text: str,
    original_groups: list[list[dict]] = None,
) -> RedesignedExtractionQuality:
    """Compute the multi-dimensional confidence score for the merged biomarkers list."""
    canonical_names = {b["canonical_name"] for b in merged_biomarkers if b.get("canonical_name")}
    
    # 1. Infer Panels and expected markers
    detected_panels = infer_panels(raw_text, canonical_names)
    
    expected_markers = set()
    critical_markers = set()
    for p in detected_panels:
        defn = PANEL_DEFINITIONS.get(p, {})
        expected_markers.update(defn.get("expected", []))
        critical_markers.update(defn.get("critical", []))

    # 2. Completeness Score
    if not expected_markers:
        completeness = 1.0
        missing_critical = []
    else:
        found_expected = expected_markers.intersection(canonical_names)
        missing_critical = [m for m in critical_markers if m not in canonical_names]
        
        # Calculate coverage: critical has weight 1.0, optional has weight 0.4
        total_weight = 0.0
        found_weight = 0.0
        for marker in expected_markers:
            weight = 1.0 if marker in critical_markers else 0.4
            total_weight += weight
            if marker in canonical_names:
                found_weight += weight
                
        completeness = round(found_weight / total_weight, 4) if total_weight > 0 else 1.0

    # 3. Extraction Confidence
    # Average of the confidence of each biomarker in the merged list
    if merged_biomarkers:
        total_conf = sum(b.get("confidence") or 0.8 for b in merged_biomarkers)
        extraction_confidence = round(total_conf / len(merged_biomarkers), 4)
    else:
        extraction_confidence = 1.0

    # 4. Agreement Score
    # Average agreement across all biomarkers
    agreement_score = 1.0
    if original_groups:
        # Map original groups by canonical_name and page
        group_map = {}
        for group in original_groups:
            if not group:
                continue
            key = (group[0]["canonical_name"], group[0].get("page"))
            group_map[key] = group

        agreements = []
        for b in merged_biomarkers:
            key = (b["canonical_name"], b.get("page"))
            group = group_map.get(key)
            if group:
                agreements.append(compute_biomarker_agreement(group))
            else:
                agreements.append(1.0)
        if agreements:
            agreement_score = round(sum(agreements) / len(agreements), 4)

    # 5. Consistency Score and Issues list
    consistency_score, issues = validate_clinical_consistency(merged_biomarkers)

    # 6. Overall Score calculation
    overall = (
        QUALITY_WEIGHTS["completeness"] * completeness +
        QUALITY_WEIGHTS["extraction_confidence"] * extraction_confidence +
        QUALITY_WEIGHTS["agreement"] * agreement_score +
        QUALITY_WEIGHTS["consistency"] * consistency_score
    )
    overall_score = round(overall, 4)

    return RedesignedExtractionQuality(
        extraction_confidence=extraction_confidence,
        completeness_score=completeness,
        agreement_score=agreement_score,
        consistency_score=consistency_score,
        overall_score=overall_score,
        detected_panels=detected_panels,
        missing_critical=missing_critical,
        issues=issues,
    )
