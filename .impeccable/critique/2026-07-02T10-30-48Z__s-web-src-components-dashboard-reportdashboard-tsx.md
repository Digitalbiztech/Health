---
target: apps/web/src/components/dashboard/ReportDashboard.tsx
total_score: 21
p0_count: 1
p1_count: 2
timestamp: 2026-07-02T10-30-48Z
slug: s-web-src-components-dashboard-reportdashboard-tsx
---
# Design Critique: apps/web/src/components/dashboard/ReportDashboard.tsx

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 1/4 | Timeline Node works, but navigation is split across top and bottom tabs. |
| 2 | Match System / Real World | 3/4 | Continuous line chart plotting normalized 0-4 values implies a sequential relationship between unrelated biomarkers, and doesn't represent real biological units. |
| 3 | User Control and Freedom | 2/4 | Timeline scroll-to action is sudden and forcefully scrolls the viewport. |
| 4 | Consistency and Standards | 3/4 | Systemic violations of rules in DESIGN.md like .glass-card and nested cards. |
| 5 | Error Prevention | 1/4 | Good compare checks. |
| 6 | Recognition Rather Than Recall | 2/4 | Double-tier tab bar hierarchy is confusing. |
| 7 | Flexibility and Efficiency | 3/4 | Clinicians have no dense table view and must scroll extensively. |
| 8 | Aesthetic and Minimalist Design | 3/4 | Visual noise is high; fake sparklines are present. |
| 9 | Error Recovery | 1/4 | API logs modal exposes low-level dev information to patients. |
| 10 | Help and Documentation | 2/4 | No explanation on reference calculation. |
| **Total** | | **21/40** | **Fair** |

## Anti-Patterns Verdict

* **LLM Assessment**: Fail. The dashboard features several SaaS/developer clichés that violate the rules in DESIGN.md:
  * **Glassmorphism & Shadows (Violates Flat-By-Default Rule):** Extensive use of `.glass-card` and `shadow-sm` on resting containers, which is prohibited.
  * **Redundant Card-Grids:** Over-segmentation of metrics (donut, bar chart, block grids, line charts) representing the same raw biomarker count/status in multiple formats.
  * **Fake Sparklines:** Use of static hardcoded SVG sine wave path overlays in the top metrics cards.
  * **Uppercase Tracked Eyebrows (Violates Anti-Eyebrow Rule):** Placed above every section header rather than reserved for standalone labels.
  * **Nested Card Boundaries:** Biomarkers inside the "Things to Watch" list are styled as individual cards nested inside another card.
  * **Text Overflow Risks:** Fixed-height cards (`h-36` with `overflow-hidden`) risk clipping translated or scaled text. Vertical labels are constrained by `w-28 shrink-0`, which will clip long panel names like `Comprehensive Metabolic Panel`.
* **Deterministic Scan**: CLI scan found 0 anti-patterns (no raw syntax issues matched).

## Overall Impression
The Report Dashboard presents a rich and feature-complete medical summary, but it struggles with visual over-stimulation and generic SaaS clichés. In trying to represent metrics in as many ways as possible, it introduces redundancy and clutters the interface, increasing cognitive load for patients and slowing down clinicians. Purging fake elements, enforcing the `Flat-By-Default` rule, and cleaning up typography hierarchy will make it feel professional, clinical, and human.

## What's Working
1. **Unified Biomarker Table & Drawers**: The detailed display modal drawer is clear, structured, and helpful.
2. **Rich Patient Demographic Header**: The overview metrics metadata cards present critical patient info correctly.

## Priority Issues

* **[P0] Contrast Violations on Chart Labels**
  * **Why it matters**: Y-axis labels using `#fbbf24` (Amber 400) and `#10b981` (Emerald 500) fail WCAG AA contrast minimums against white backings, rendering them unreadable for elderly and low-vision patients.
  * **Fix**: Change tick label colors to high-contrast variables or darker tints (like `var(--muted-foreground)` or `var(--primary-text)`).
  * **Suggested command**: `/impeccable colorize apps/web/src/components/dashboard/ReportDashboard.tsx`

* **[P1] Design System Violations (Glassmorphism & Shadows)**
  * **Why it matters**: Breaks the design guidelines in DESIGN.md, causing visual inconsistency.
  * **Fix**: Replace `.glass-card` and custom shadows with flat borders (`border border-border/60 bg-card`) as defined in the `Flat-By-Default` rule.
  * **Suggested command**: `/impeccable quieter apps/web/src/components/dashboard/ReportDashboard.tsx`

* **[P1] Chart Layout Redundancy**
  * **Why it matters**: Presenting donut, bar, and line charts showing the same grouping values increases visual clutter and anxiety.
  * **Fix**: Consolidate the chart views or remove redundant layout grids.
  * **Suggested command**: `/impeccable distill apps/web/src/components/dashboard/ReportDashboard.tsx`

* **[P2] Fixed-Height Layout Clipping**
  * **Why it matters**: Hardcoded dimensions (`h-36` and `w-28`) truncate patient names and panel titles on smaller screen widths.
  * **Fix**: Remove fixed heights and widths in favor of responsive flex wrap/grid layouts.
  * **Suggested command**: `/impeccable layout apps/web/src/components/dashboard/ReportDashboard.tsx`

* **[P3] Nested Cards & Line Length**
  * **Why it matters**: Stacking cards within cards violates the layout guidelines, and lines exceeding 75ch fatigue the reader.
  * **Fix**: Remove nested card styles and restrict paragraph widths to max-w-prose (65-75ch).
  * **Suggested command**: `/impeccable typeset apps/web/src/components/dashboard/ReportDashboard.tsx`

## Persona Red Flags

* **Alex (Power User / Clinician)**: Wastes visual scanning space on large slider segments; the lack of a dense, filterable clinical table speeds down report comparisons.
* **Jordan (First-Time Patient)**: Overwhelmed by low-level developer-like API logs and high-severity status badges that lack context, causing diagnostic panic.

## Minor Observations
* Commented-out unused code imports and variables should be cleaned up.
* Custom scrollbar scroll handles are too thin for easy touch targeting.

## Questions to Consider
1. Does showing patients the comparative raw output of PyMuPDF vs. pdfplumber build confidence, or does it make our backend feel experimental?
2. If we are graphing biomarkers as a continuous line chart, does that create a false medical impression that there is a biological progression linking Blood Count metrics directly to Vitamin levels?
3. How can we expect a patient to remain calm when our dashboard mimics the visual intensity and metric density of a high-growth stock-trading interface?
