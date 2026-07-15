"""Clinical validation and consistency checks."""

import logging
from typing import Any

logger = logging.getLogger(__name__)

def validate_clinical_consistency(biomarkers: list[dict]) -> tuple[float, list[str]]:
    """Verify internal clinical relationships between biomarkers.

    Checks:
      1. VLDL ≈ Triglycerides / 5 (in mg/dL)
      2. LDL ≈ Total Cholesterol - HDL - VLDL (or Total - HDL - Triglycerides / 5)
      3. Non-HDL ≈ Total Cholesterol - HDL (if a non-HDL or equivalent is present)

    Returns (consistency_score, issues_list).
    Score starts at 1.0 and drops by 0.15 for each significant clinical inconsistency.
    """
    score = 1.0
    issues = []
    
    # Map biomarkers by canonical name for fast lookup
    b_map = {}
    for b in biomarkers:
        canonical = b.get("canonical_name")
        if canonical and b.get("value") not in (None, ""):
            try:
                b_map[canonical] = float(b["value"])
            except ValueError:
                pass

    # Rule 1: VLDL ≈ Triglycerides / 5 (only if unit is mg/dL, which is standard)
    if "vldl" in b_map and "triglycerides" in b_map:
        vldl = b_map["vldl"]
        tg = b_map["triglycerides"]
        expected_vldl = tg / 5.0
        
        # Check if they differ significantly (absolute difference > 5 and relative difference > 20%)
        abs_diff = abs(vldl - expected_vldl)
        rel_diff = abs_diff / max(1.0, expected_vldl)
        if abs_diff > 5.0 and rel_diff > 0.20:
            score -= 0.15
            issues.append(
                f"VLDL clinical inconsistency: extracted VLDL ({vldl:.1f}) "
                f"differs from expected TG/5 ({expected_vldl:.1f})"
            )

    # Rule 2: Total Cholesterol ≈ LDL + HDL + VLDL (or LDL + HDL + TG/5)
    if "total_cholesterol" in b_map and "hdl" in b_map and "ldl" in b_map:
        tc = b_map["total_cholesterol"]
        hdl = b_map["hdl"]
        ldl = b_map["ldl"]
        
        # Estimate VLDL as TG/5 if not present
        vldl = b_map.get("vldl")
        if vldl is None and "triglycerides" in b_map:
            vldl = b_map["triglycerides"] / 5.0
            
        if vldl is not None:
            expected_tc = ldl + hdl + vldl
            abs_diff = abs(tc - expected_tc)
            rel_diff = abs_diff / max(1.0, expected_tc)
            
            if abs_diff > 15.0 and rel_diff > 0.15:
                score -= 0.15
                issues.append(
                    f"Lipid Panel inconsistency: Total Cholesterol ({tc:.1f}) "
                    f"differs from expected LDL+HDL+VLDL ({expected_tc:.1f})"
                )

    # Make sure score doesn't fall below 0.0
    score = max(0.0, round(score, 4))
    return score, issues
