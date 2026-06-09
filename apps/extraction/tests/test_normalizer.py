"""Tests for the biomarker normalization engine."""

import pytest

from app.parsers.normalizer import (
    ResolvedName,
    classify_status,
    convert_unit,
    normalize_batch,
    normalize_biomarker,
    resolve_name,
    resolve_names_batch,
)
from app.parsers.fuzzy import levenshtein_distance, levenshtein_ratio, token_set_score


# ── Fuzzy utilities ──────────────────────────────────────────


class TestLevenshtein:
    def test_identical(self):
        assert levenshtein_distance("abc", "abc") == 0
        assert levenshtein_ratio("abc", "abc") == 1.0

    def test_empty(self):
        assert levenshtein_distance("", "") == 0
        assert levenshtein_distance("abc", "") == 3
        assert levenshtein_ratio("", "") == 1.0

    def test_single_edit(self):
        assert levenshtein_distance("cat", "car") == 1
        assert levenshtein_distance("cat", "cats") == 1

    def test_ratio_range(self):
        r = levenshtein_ratio("hemoglobin", "hemoglobn")
        assert 0.8 < r < 1.0


class TestTokenSetScore:
    def test_identical(self):
        assert token_set_score("fasting glucose", "fasting glucose") == 1.0

    def test_reordered(self):
        assert token_set_score("glucose fasting", "fasting glucose") == 1.0

    def test_partial_overlap(self):
        score = token_set_score("fasting blood glucose", "glucose fasting")
        assert 0.5 < score < 1.0

    def test_no_overlap(self):
        assert token_set_score("abc", "xyz") == 0.0


# ── Name resolution ──────────────────────────────────────────


class TestResolveName:
    def test_exact_canonical(self):
        r = resolve_name("hba1c")
        assert r is not None
        assert r.canonical_name == "hba1c"
        assert r.confidence == 1.0
        assert r.method == "exact"

    def test_exact_alias(self):
        r = resolve_name("hemoglobin a1c")
        assert r is not None
        assert r.canonical_name == "hba1c"
        assert r.confidence == 1.0

    def test_case_insensitive(self):
        r = resolve_name("Hemoglobin A1c")
        assert r is not None
        assert r.canonical_name == "hba1c"

    def test_case_insensitive_upper(self):
        r = resolve_name("HEMOGLOBIN A1C")
        assert r is not None
        assert r.canonical_name == "hba1c"

    def test_suffix_strip(self):
        r = resolve_name("glucose fasting level")
        assert r is not None
        assert r.canonical_name == "fasting_glucose"
        assert r.method == "suffix_strip"
        assert r.confidence == 0.95

    def test_suffix_strip_test(self):
        r = resolve_name("hemoglobin test")
        assert r is not None
        assert r.canonical_name == "hemoglobin"

    def test_abbreviation_match(self):
        r = resolve_name("HbA1c")
        assert r is not None
        assert r.canonical_name == "hba1c"
        # Could be exact or abbreviation depending on alias list

    def test_abbreviation_fbs(self):
        r = resolve_name("FBS")
        assert r is not None
        assert r.canonical_name == "fasting_glucose"

    def test_unknown_returns_none(self):
        r = resolve_name("totally unknown biomarker xyz")
        assert r is None

    def test_empty_returns_none(self):
        r = resolve_name("")
        assert r is None

    def test_new_biomarkers_exist(self):
        """Verify newly added biomarkers resolve."""
        for name in ["mcv", "mch", "ggt", "ldh", "chloride", "magnesium", "vldl", "free t3", "glucose", "testosterone total", "free testosterone"]:
            r = resolve_name(name)
            assert r is not None, f"Expected {name} to resolve"
            assert r.confidence == 1.0

    def test_parentheses_resolutions(self):
        """Verify AST and ALT resolve correctly with spacing and parentheses."""
        for name in ["ast sgot", "ast (sgot)", "ast(sgot)", "alt sgpt", "alt (sgpt)", "alt(sgpt)"]:
            r = resolve_name(name)
            assert r is not None, f"Expected {name} to resolve"
            assert r.canonical_name in ("ast", "alt")
            assert r.confidence == 1.0


# ── Unit conversion ──────────────────────────────────────────


class TestConvertUnit:
    def test_no_conversion_needed(self):
        val, unit = convert_unit("hba1c", 5.4, "%")
        assert val == 5.4
        assert unit == "%"

    def test_mmol_to_mgdl(self):
        val, unit = convert_unit("fasting_glucose", 5.0, "mmol/L")
        assert unit == "mg/dL"
        assert abs(val - 90.091) < 0.1

    def test_unknown_unit(self):
        val, unit = convert_unit("hba1c", 5.4, "weird_unit")
        assert val == 5.4
        assert unit == "weird_unit"


# ── Status classification ────────────────────────────────────


class TestClassifyStatus:
    def test_normal(self):
        assert classify_status("fasting_glucose", 85) == "NORMAL"

    def test_low(self):
        assert classify_status("fasting_glucose", 65) == "LOW"

    def test_high(self):
        assert classify_status("fasting_glucose", 110) == "HIGH"

    def test_critical_high(self):
        assert classify_status("fasting_glucose", 450) == "CRITICAL"

    def test_critical_low(self):
        assert classify_status("fasting_glucose", 45) == "CRITICAL"

    def test_boundary_min(self):
        assert classify_status("fasting_glucose", 70) == "NORMAL"

    def test_boundary_max(self):
        assert classify_status("fasting_glucose", 100) == "NORMAL"


# ── Full normalization ───────────────────────────────────────


class TestNormalizeBiomarker:
    def test_basic(self):
        result = normalize_biomarker("hba1c", "5.4", "%")
        assert result is not None
        assert result["canonical_name"] == "hba1c"
        assert result["status"] == "NORMAL"
        assert result["confidence"] == 1.0
        assert result["match_method"] == "exact"

    def test_with_unit_conversion(self):
        result = normalize_biomarker("fasting glucose", "5.0", "mmol/L")
        assert result is not None
        assert result["unit"] == "mg/dL"
        assert result["status"] == "NORMAL"

    def test_unparseable_value(self):
        result = normalize_biomarker("hba1c", "N/A", "%")
        assert result is None

    def test_unknown_name(self):
        result = normalize_biomarker("unknown thing", "5.0", "mg/dL")
        assert result is None

    def test_value_with_comma(self):
        result = normalize_biomarker("platelets", "250,000", "x10³/µL")
        assert result is not None

    def test_custom_pdf_ranges(self):
        # fasting glucose default range is 70 - 100
        # If value is 105, it is normally HIGH:
        res_normal = normalize_biomarker("fasting glucose", "105", "mg/dL")
        assert res_normal["status"] == "HIGH"
        assert res_normal["reference_range"] == "70 - 100 mg/dL"

        # If we override the range with PDF ranges, 105 becomes NORMAL:
        res_custom = normalize_biomarker(
            "fasting glucose", "105", "mg/dL", pdf_ref_min=70.0, pdf_ref_max=110.0
        )
        assert res_custom["status"] == "NORMAL"
        assert res_custom["reference_min"] == 70.0
        assert res_custom["reference_max"] == 110.0
        assert "70.0 - 110.0" in res_custom["reference_range"]


# ── Batch normalization ──────────────────────────────────────


class TestNormalizeBatch:
    def test_mixed(self):
        inputs = [
            {"name": "hba1c", "value": "5.4", "unit": "%"},
            {"name": "unknown marker", "value": "1.0", "unit": "mg/dL"},
            {"name": "hemoglobin", "value": "14.5", "unit": "g/dL"},
        ]
        results = normalize_batch(inputs)
        assert len(results) == 2
        assert results[0]["canonical_name"] == "hba1c"
        assert results[1]["canonical_name"] == "hemoglobin"

    def test_min_confidence_filter(self):
        inputs = [
            {"name": "hba1c", "value": "5.4", "unit": "%"},  # exact → 1.0
        ]
        results = normalize_batch(inputs, min_confidence=1.0)
        assert len(results) == 1

    def test_empty(self):
        assert normalize_batch([]) == []


# ── Batch name resolution ────────────────────────────────────


class TestResolveNamesBatch:
    def test_basic(self):
        results = resolve_names_batch(["Hemoglobin A1c", "HbA1c", "A1C", "totally unknown"])
        assert len(results) == 4

        assert results[0]["canonical_name"] == "hba1c"
        assert results[0]["confidence"] == 1.0

        assert results[1]["canonical_name"] == "hba1c"

        assert results[2]["canonical_name"] == "hba1c"

        assert results[3]["canonical_name"] is None
        assert results[3]["match_method"] == "none"
