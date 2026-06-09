"""Unit tests for the Extraction Quality Engine and PDF classifier."""

import pytest
from app.parsers.quality import (
    PANEL_DEFINITIONS,
    ExtractionQuality,
    detect_panels,
    compute_coverage,
    compute_structural_score,
    compute_critical_score,
    score_extraction,
    should_fallback,
)
from app.extractors.pymupdf import classify_pdf


class TestQualityEngine:
    def test_detect_panels_empty(self):
        assert detect_panels(set()) == []

    def test_detect_panels_cbc(self):
        # CBC has 8 expected markers. 2 is minimum to detect.
        markers = {"hemoglobin", "wbc"}
        panels = detect_panels(markers)
        assert "CBC" in panels

    def test_detect_panels_multiple(self):
        markers = {"hemoglobin", "wbc", "total_cholesterol", "ldl"}
        panels = detect_panels(markers)
        assert "CBC" in panels
        assert "Lipid Panel" in panels

    def test_compute_coverage_empty(self):
        assert compute_coverage(set(), []) == 1.0

    def test_compute_coverage_cbc(self):
        # CBC has 8 expected markers
        markers = {"hemoglobin", "wbc", "rbc", "platelets"}
        coverage = compute_coverage(markers, ["CBC"])
        assert coverage == 0.5  # 4 / 8

    def test_compute_structural_score(self):
        # 1 complete, 1 incomplete
        biomarkers = [
            {
                "canonical_name": "hemoglobin",
                "value": "14.5",
                "unit": "g/dL",
                "reference_range": "12 - 17",
            },
            {
                "canonical_name": "wbc",
                "value": "",  # missing value
                "unit": "x10³/µL",
                "reference_range": "4.5 - 11",
            },
        ]
        assert compute_structural_score(biomarkers) == 0.5

    def test_compute_critical_score(self):
        # CBC critical markers: ["hemoglobin", "wbc", "rbc", "platelets"]
        markers = {"hemoglobin", "wbc"}
        score, missing = compute_critical_score(markers, ["CBC"])
        assert score == 0.5
        assert set(missing) == {"rbc", "platelets"}

    def test_score_extraction(self):
        normalized = [
            {
                "canonical_name": "hemoglobin",
                "value": "14.5",
                "unit": "g/dL",
                "reference_range": "12 - 17",
            },
            {
                "canonical_name": "wbc",
                "value": "6.0",
                "unit": "x10³/µL",
                "reference_range": "4.5 - 11",
            },
        ]
        quality = score_extraction("pymupdf", normalized)
        assert isinstance(quality, ExtractionQuality)
        assert quality.extractor == "pymupdf"
        assert quality.markers_found == 2
        assert "CBC" in quality.detected_panels
        assert quality.confidence_score > 0.0

    def test_should_fallback_confidence(self):
        # Low confidence (< 0.90) should trigger fallback
        q = ExtractionQuality(extractor="pymupdf", confidence_score=0.85)
        assert should_fallback(q) is True

        # High confidence (>= 0.90) and no missing criticals should not trigger fallback
        q2 = ExtractionQuality(extractor="pymupdf", confidence_score=0.95, missing_critical=[])
        assert should_fallback(q2) is False

    def test_should_fallback_missing_critical(self):
        # High confidence but missing criticals should trigger fallback
        q = ExtractionQuality(
            extractor="pymupdf",
            confidence_score=0.95,
            missing_critical=["hemoglobin"],
        )
        assert should_fallback(q) is True


class TestPDFClassifier:
    def test_classify_text_pdf(self):
        # Minimal dummy PDF with text content
        import fitz
        doc = fitz.open()
        page = doc.new_page()
        page.insert_text((50, 50), "This is a clean medical report containing HbA1c and Glucose levels.")
        pdf_bytes = doc.write()
        doc.close()

        assert classify_pdf(pdf_bytes) == "text"

    def test_classify_image_pdf(self):
        # Minimal dummy PDF with no text content
        import fitz
        doc = fitz.open()
        doc.new_page()  # Empty page
        pdf_bytes = doc.write()
        doc.close()

        assert classify_pdf(pdf_bytes) == "image"
