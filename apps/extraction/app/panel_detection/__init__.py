"""Clinical panel inference logic."""

import logging
from typing import Any

logger = logging.getLogger(__name__)

# Shared panel definitions
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

PANEL_KEYWORDS: dict[str, list[str]] = {
    "CBC": ["cbc", "complete blood count", "hemogram", "hematology", "white blood", "red blood", "platelets"],
    "Lipid Panel": ["lipid", "cholesterol", "triglycerides", "hdl", "ldl", "vldl", "coronary", "cardiovascular"],
    "Kidney": ["kidney", "renal", "creatinine", "egfr", "bun", "uric acid"],
    "Liver": ["liver", "hepatic", "alt", "ast", "bilirubin", "albumin", "alp", "ggt", "globulin"],
    "Electrolytes": ["electrolyte", "sodium", "potassium", "calcium", "chloride", "magnesium", "phosphorus"],
    "Thyroid": ["thyroid", "tsh", "t3", "t4", "thyroxine", "triiodothyronine"],
    "Diabetes": ["diabetes", "hba1c", "glycated", "glucose", "insulin", "fasting glucose"],
    "Iron Studies": ["iron", "ferritin", "transferrin", "tibc"],
    "Vitamins": ["vitamin", "folate", "b12"],
    "Inflammation": ["crp", "c-reactive", "esr", "sedimentation"],
}

def infer_panels(text: str, canonical_names: set[str]) -> list[str]:
    """Infer expected clinical panels based on text keywords and marker presence.

    Avoids arbitrary small-marker-count penalties by matching textual context
    (like headers/titles) first, and requiring larger biomarker subsets for fallbacks.
    """
    text_lower = (text or "").lower()
    inferred: list[str] = []

    for panel_name, keywords in PANEL_KEYWORDS.items():
        # 1. Match textual keywords (headers, titles, package name)
        matched_kw = any(kw in text_lower for kw in keywords)

        # 2. Match significant subset of panel markers (fallback)
        defn = PANEL_DEFINITIONS.get(panel_name, {})
        expected = defn.get("expected", [])
        found_markers = [m for m in expected if m in canonical_names]
        
        # Require at least 3 markers or 50% of the expected markers of the panel
        matched_markers = len(found_markers) >= max(3, int(len(expected) * 0.5))

        if matched_kw or matched_markers:
            inferred.append(panel_name)

    logger.info("Inferred clinical panels: %s", inferred)
    return inferred
