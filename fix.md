# Bloodwork Report — Round 4 Fixes

Context: Round 3's glyph/character corruption bug is fixed, and panel-break layout now holds together well. This round covers a new decimal-rendering bug, a data-loss issue on reference ranges, a broken slider positioning bug, a regression on the color scale, and a branding visibility issue.

---

## 1. CRITICAL — Decimal point dropping in rendered output

**Bug:** Free Testosterone's underlying value is `57.6 pg/mL`, but the rendered PDF shows `576 pg/mL` — the decimal point is not surviving into the final render. Reference range is 46–224 pg/mL, so a patient seeing "576" next to a green "NORMAL" badge sees a number 10x outside the stated range paired with a status that says it's fine.

**Fix:**
- [ ] Find and fix wherever the decimal point is being stripped between the data layer and the rendered PDF (likely a formatting/rounding step, a font/text-rendering issue, or a string-concat bug similar to round 3's issue).
- [ ] Audit every marker with a decimal value across all panels to confirm decimals survive in the actual rendered output, not just the underlying data — at minimum re-check: Free Testosterone (57.6), MCV (96.1), MCH (32.1), MCHC (33.4), RDW (11.7), Creatinine (1.09), TSH (2.61), Cholesterol/HDL Ratio (2.5), A/G Ratio (2.1).
- [ ] This is a repeat category of bug from round 3 (wrong number displayed to patient) — treat as a blocker, same as last round.

---

## 2. Reference ranges silently losing their upper bound

**Bug:** Comparing to original source data, some two-sided reference ranges have lost their upper bound and now render as open-ended:
- Total Testosterone: originally `250 – 827 ng/dL`, now shows `Ref: > 250 ng/dL`.
- Bioavailable Testosterone: originally `110 – 575 ng/dL`, now shows `Ref: > 110 ng/dL`.

These are NOT the same as the genuinely open-ended ranges (eGFR, HDL) where the original data used an arbitrary high cap (999) as a placeholder — these two had real, meaningful upper clinical bounds that have gone missing somewhere in the pipeline.

**Fix:**
- [ ] Trace whether the upper bound is being dropped in the data layer or just in the display logic, and restore it.
- [ ] Audit all other two-sided ranges to confirm none of them are silently losing a bound the same way.

---

## 3. Slider position indicator not reflecting actual value

**Bug:** Every biomarker's slider dot is rendering at the same starting position (far left) regardless of the marker's actual result and where it falls in the range. The dot is supposed to visually mark where the patient's result sits within the reference range, but currently it doesn't move — it's stuck at the same spot on every single row across every panel.

**Fix:**
- [ ] Debug the position-calculation logic for the slider marker — it should map `(result - range_min) / (range_max - range_min)` (or equivalent for one-sided ranges) to a horizontal position along the bar, per row.
- [ ] Confirm visually after the fix that markers with different values in different parts of their range actually show the dot in different positions — e.g. a value near the low end of its range should show the dot near the left, a value near the high end near the right.
- [ ] This affects every single slider in the document (all 41 markers) — high-impact bug since it makes the core visual feature currently non-functional/decorative only.

---

## 4. Restore the 5-tier color scale (very low / low / moderate / high / very high)

**Bug:** The sliders were originally spec'd to use a 5-zone scale (very low, low, moderate/optimal, high, very high), but the current version only shows 3 zones (low/yellow, moderate/green, high/red).

**Fix:**
- [ ] Restore the full 5-tier gradient: very low, low, moderate (optimal), high, very high — each a distinct zone/color intensity, not just 3 flattened bands.
- [ ] Keep the muted/desaturated palette established in round 2 — apply the same muted tones across all 5 zones rather than reverting to bright saturated colors.
- [ ] Make sure this 5-tier scale is applied consistently to both the compact inline sliders (normal markers) and the expanded flagged-marker card (e.g. White Blood Cells on page 1/2).

---

## 5. Company logo not visible in header

**Bug:** The "CONCIERGE" wordmark/logo in the dark navy header bar (above the patient details section, top of every page) is not visible — appears to be rendering at very low contrast/opacity against the navy background, effectively invisible.

**Fix:**
- [ ] Increase contrast of the logo against the navy header background — either lighten the logo color, add an outline/glow, or use a reversed/white version of the logo on dark backgrounds.
- [ ] Verify visibility on all 4 pages, since the header repeats on every page.

---

## Priority order

1. Decimal rendering bug (item 1) — wrong number shown to patient, blocker.
2. Slider position bug (item 3) — core feature is currently non-functional across all 41 markers.
3. Dropped reference-range upper bounds (item 2) — data-integrity issue.
4. Restore 5-tier color scale (item 4) — spec regression.
5. Logo visibility (item 5) — branding/polish, lowest risk but easy fix.