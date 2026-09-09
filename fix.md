# Bloodwork Report — Round 5 Fixes

Context: Rounds 1-4 are resolved — decimals render correctly, reference ranges are intact, slider position dots now correctly reflect each result's location in range, the 5-tier color scale is restored, and the header logo is visible. One issue remains.

---

## 1. "Panels Distribution" card legend is incomplete (page 1)

**Bug:** The donut chart's center correctly shows "41 MARKERS" total, but the legend beside it only lists 5 of the 9 panels:
- CBC — 10
- Lipid — 7
- Diabetes — 2
- Kidney — 3
- Electrolytes — 5

That's 27 markers accounted for. The remaining 4 panels and 14 markers are missing from the legend entirely:
- Liver — 8
- Thyroid — 1
- Hormones — 4
- Vitamins — 1

The donut ring itself appears to render more color segments than the legend has rows, so the chart is drawing correctly but the legend is truncated — likely a fixed-height container or a hardcoded/sliced list (e.g. `.slice(0, 5)`) limiting the legend to the first 5 panels instead of all 9.

**Why this matters:** Anyone who adds up the visible legend numbers gets 27, not 41 — the card contradicts its own center total. It also hides 4 full panels (including Liver and Hormones, which are clinically significant) from the summary view entirely.

**Fix:**
- [ ] Remove whatever length limit is truncating the legend to 5 items — render all 9 panels.
- [ ] If vertical space is a real constraint, switch the legend to two columns (e.g. 5 + 4, or split evenly) rather than dropping items — do not silently cut off data.
- [ ] After the fix, verify the legend's individual counts sum to 41 (matching the donut center) and that each of the 9 panel names shown elsewhere in the report (CBC, Lipid, Diabetes, Kidney, Electrolytes, Liver, Thyroid, Hormones, Vitamins) appears in this legend.

---

## Priority

This is the only outstanding item — treat as a straightforward fix-and-verify (confirm legend sum = 41 and all 9 panels present) before sign-off.