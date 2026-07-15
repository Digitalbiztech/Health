"""Unit tests for the merge-first extraction pipeline, resolver, and quality engine."""

import pytest
from app.merge import merge_biomarkers, is_similar_value
from app.resolver import resolve_conflicts, disagree_significantly
from app.quality import score_merged_extraction, compute_biomarker_agreement
from app.panel_detection import infer_panels

def test_identical_values():
    # 1. Identical values: Multiple extractors extract identical values for a biomarker on the same page
    group = [
        {
            "canonical_name": "hba1c",
            "display_name": "HbA1c",
            "original_name": "hba1c",
            "value": "5.4",
            "unit": "%",
            "reference_range": "4.0 - 5.6 %",
            "page": 1,
            "confidence": 1.0,
            "extractor": "pymupdf"
        },
        {
            "canonical_name": "hba1c",
            "display_name": "HbA1c",
            "original_name": "HbA1c",
            "value": "5.4",
            "unit": "%",
            "reference_range": "4.0 - 5.6 %",
            "page": 1,
            "confidence": 0.88,
            "extractor": "pdfplumber"
        }
    ]
    resolved = resolve_conflicts(group)
    assert resolved["value"] == "5.4"
    assert resolved["agreement"] is True
    assert resolved["requires_review"] is False
    assert resolved["confidence"] == 1.0  # Boosted/Maxed or kept at best (1.0 + 0.05 capped at 1.0)
    assert set(resolved["sources"]) == {"pymupdf", "pdfplumber"}

def test_conflicting_values():
    # 2. Conflicting values: Prefer highest confidence, then fallback priority
    group = [
        {
            "canonical_name": "hba1c",
            "display_name": "HbA1c",
            "value": "5.4",
            "unit": "%",
            "page": 1,
            "confidence": 0.88,
            "extractor": "pdfplumber"
        },
        {
            "canonical_name": "hba1c",
            "display_name": "HbA1c",
            "value": "5.9",
            "unit": "%",
            "page": 1,
            "confidence": 0.75,
            "extractor": "mistral_ocr"
        }
    ]
    resolved = resolve_conflicts(group)
    # Prefer pdfplumber over mistral_ocr because of higher confidence and priority
    assert resolved["value"] == "5.4"
    assert resolved["agreement"] is False
    # 5.4 vs 5.9 is within 10% (diff 0.5, avg 5.65 -> 8.8%), so it shouldn't trigger requires_review.
    # Let's test a significant conflict next:

    group_sig = [
        {
            "canonical_name": "hba1c",
            "display_name": "HbA1c",
            "value": "5.4",
            "unit": "%",
            "page": 1,
            "confidence": 0.88,
            "extractor": "pdfplumber"
        },
        {
            "canonical_name": "hba1c",
            "display_name": "HbA1c",
            "value": "6.8",
            "unit": "%",
            "page": 1,
            "confidence": 0.75,
            "extractor": "mistral_ocr"
        }
    ]
    resolved_sig = resolve_conflicts(group_sig)
    assert resolved_sig["value"] == "5.4"
    assert resolved_sig["agreement"] is False
    assert resolved_sig["requires_review"] is True  # > 10% difference

def test_missing_units():
    # 3. Missing units: Prefer the complete record
    group = [
        {
            "canonical_name": "glucose",
            "display_name": "Glucose",
            "value": "95",
            "unit": "",
            "page": 1,
            "confidence": 0.95,
            "extractor": "pymupdf"
        },
        {
            "canonical_name": "glucose",
            "display_name": "Glucose",
            "value": "95",
            "unit": "mg/dL",
            "page": 1,
            "confidence": 0.88,
            "extractor": "pdfplumber"
        }
    ]
    resolved = resolve_conflicts(group)
    assert resolved["value"] == "95"
    assert resolved["unit"] == "mg/dL"  # Kept the unit from pdfplumber

def test_missing_reference_ranges():
    # 4. Missing reference ranges: Merge reference range and metadata
    group = [
        {
            "canonical_name": "hba1c",
            "display_name": "HbA1c",
            "value": "5.4",
            "unit": "%",
            "reference_range": "",
            "page": 1,
            "confidence": 0.95,
            "extractor": "pymupdf"
        },
        {
            "canonical_name": "hba1c",
            "display_name": "HbA1c",
            "value": "5.4",
            "unit": "%",
            "reference_range": "4.0 - 5.6 %",
            "page": 1,
            "confidence": 0.88,
            "extractor": "pdfplumber"
        }
    ]
    resolved = resolve_conflicts(group)
    assert resolved["reference_range"] == "4.0 - 5.6 %"

def test_duplicate_biomarkers():
    # 5. Duplicate biomarkers: Deduplicated and merged
    candidates = [
        [
            {
                "canonical_name": "hba1c",
                "display_name": "HbA1c",
                "value": "5.4",
                "unit": "%",
                "page": 1,
                "confidence": 0.95,
                "extractor": "pymupdf"
            }
        ],
        [
            {
                "canonical_name": "hba1c",
                "display_name": "HbA1c",
                "value": "5.4",
                "unit": "%",
                "page": 1,
                "confidence": 0.88,
                "extractor": "pdfplumber"
            }
        ]
    ]
    merged = merge_biomarkers(candidates)
    assert len(merged) == 1
    assert merged[0]["value"] == "5.4"
    assert set(merged[0]["sources"]) == {"pymupdf", "pdfplumber"}

def test_ocr_only_biomarkers():
    # 6. OCR-only biomarkers are retained
    candidates = [
        [],  # pymupdf empty
        [],  # pdfplumber empty
        [
            {
                "canonical_name": "hba1c",
                "display_name": "HbA1c",
                "value": "5.4",
                "unit": "%",
                "page": 1,
                "confidence": 0.75,
                "extractor": "mistral_ocr"
            }
        ]
    ]
    merged = merge_biomarkers(candidates)
    assert len(merged) == 1
    assert merged[0]["extractor"] == "mistral_ocr"
    assert merged[0]["sources"] == ["mistral_ocr"]

def test_pymupdf_only_biomarkers():
    # 7. PyMuPDF-only biomarkers are retained
    candidates = [
        [
            {
                "canonical_name": "hba1c",
                "display_name": "HbA1c",
                "value": "5.4",
                "unit": "%",
                "page": 1,
                "confidence": 0.95,
                "extractor": "pymupdf"
            }
        ],
        []
    ]
    merged = merge_biomarkers(candidates)
    assert len(merged) == 1
    assert merged[0]["extractor"] == "pymupdf"
    assert merged[0]["sources"] == ["pymupdf"]

def test_three_way_merge():
    # 8. Three-way merge: PyMuPDF + pdfplumber + OCR
    candidates = [
        [
            {
                "canonical_name": "hba1c",
                "display_name": "HbA1c",
                "value": "5.4",
                "unit": "%",
                "page": 1,
                "confidence": 0.95,
                "extractor": "pymupdf"
            }
        ],
        [
            {
                "canonical_name": "glucose",
                "display_name": "Glucose",
                "value": "95",
                "unit": "mg/dL",
                "page": 1,
                "confidence": 0.88,
                "extractor": "pdfplumber"
            }
        ],
        [
            {
                "canonical_name": "total_cholesterol",
                "display_name": "Total Cholesterol",
                "value": "180",
                "unit": "mg/dL",
                "page": 1,
                "confidence": 0.75,
                "extractor": "mistral_ocr"
            }
        ]
    ]
    merged = merge_biomarkers(candidates)
    assert len(merged) == 3
    names = {b["canonical_name"] for b in merged}
    assert names == {"hba1c", "glucose", "total_cholesterol"}

def test_conflicting_units():
    # 9. Conflicting units: resolved/merged
    # (Since units are typically already standardized during normalization, let's verify resolver merges them)
    group = [
        {
            "canonical_name": "glucose",
            "display_name": "Glucose",
            "value": "95",
            "unit": "mg/dL",
            "page": 1,
            "confidence": 0.95,
            "extractor": "pymupdf"
        },
        {
            "canonical_name": "glucose",
            "display_name": "Glucose",
            "value": "95",
            "unit": "mmol/L",  # different unit
            "page": 1,
            "confidence": 0.88,
            "extractor": "pdfplumber"
        }
    ]
    resolved = resolve_conflicts(group)
    assert resolved["unit"] == "mg/dL"  # priority unit from pymupdf

def test_incomplete_rows():
    # 10. Incomplete rows: handled by resolution priority
    group = [
        {
            "canonical_name": "hba1c",
            "display_name": "HbA1c",
            "value": "",
            "unit": "",
            "page": 1,
            "confidence": 0.95,
            "extractor": "pymupdf"
        },
        {
            "canonical_name": "hba1c",
            "display_name": "HbA1c",
            "value": "5.4",
            "unit": "%",
            "page": 1,
            "confidence": 0.88,
            "extractor": "pdfplumber"
        }
    ]
    resolved = resolve_conflicts(group)
    assert resolved["value"] == "5.4"
    assert resolved["unit"] == "%"

def test_multi_page_reports():
    # 11. Multi-page reports: Biomarkers separated by page are kept separate
    candidates = [
        [
            {
                "canonical_name": "hba1c",
                "display_name": "HbA1c",
                "value": "5.4",
                "unit": "%",
                "page": 1,
                "confidence": 0.95,
                "extractor": "pymupdf"
            },
            {
                "canonical_name": "hba1c",
                "display_name": "HbA1c",
                "value": "5.6",
                "unit": "%",
                "page": 2,
                "confidence": 0.95,
                "extractor": "pymupdf"
            }
        ]
    ]
    merged = merge_biomarkers(candidates)
    assert len(merged) == 2
    pages = {b["page"] for b in merged}
    assert pages == {1, 2}

def test_biomarkers_appearing_twice():
    # 12. Biomarkers appearing twice on the same page with different values
    # In this case they key on same page and canonical name, so they will be resolved as conflict
    candidates = [
        [
            {
                "canonical_name": "hba1c",
                "display_name": "HbA1c",
                "value": "5.4",
                "unit": "%",
                "page": 1,
                "confidence": 0.95,
                "extractor": "pymupdf"
            }
        ],
        [
            {
                "canonical_name": "hba1c",
                "display_name": "HbA1c",
                "value": "5.8",
                "unit": "%",
                "page": 1,
                "confidence": 0.88,
                "extractor": "pdfplumber"
            }
        ]
    ]
    merged = merge_biomarkers(candidates)
    assert len(merged) == 1
    assert merged[0]["value"] == "5.4"
    assert merged[0]["agreement"] is False

def test_missing_optional_markers():
    # 13. Reports with missing optional markers: checking completeness calculation
    merged = [
        {
            "canonical_name": "hemoglobin",
            "value": "14.5",
            "unit": "g/dL",
            "confidence": 1.0,
        },
        {
            "canonical_name": "wbc",
            "value": "7.0",
            "unit": "x10³/µL",
            "confidence": 1.0,
        },
        {
            "canonical_name": "rbc",
            "value": "4.5",
            "unit": "x10⁶/µL",
            "confidence": 1.0,
        },
        {
            "canonical_name": "platelets",
            "value": "250",
            "unit": "x10³/µL",
            "confidence": 1.0,
        }
    ]
    # For CBC panel:
    # Expected: hemoglobin, wbc, rbc, platelets (critical)
    # hematocrit, mcv, mch, mchc (optional)
    # We have all critical ones. Let's compute completeness.
    quality = score_merged_extraction(merged, "This is a CBC Complete Blood Count report.")
    assert "CBC" in quality.detected_panels
    assert len(quality.missing_critical) == 0
    # Completeness should be lower than 1.0 because optional markers like hematocrit, mcv, mch, mchc are missing.
    assert quality.completeness_score < 1.0
    # Now add one more optional marker. Completeness score should increase!
    merged.append({
        "canonical_name": "mcv",
        "value": "90",
        "unit": "fL",
        "confidence": 1.0,
    })
    quality_more = score_merged_extraction(merged, "This is a CBC Complete Blood Count report.")
    assert quality_more.completeness_score > quality.completeness_score
