---
target: apps/web/src/components/dashboard/ClinicalSection.tsx
total_score: 12
p0_count: 1
p1_count: 3
timestamp: 2026-07-02T17-05-15Z
slug: s-web-src-components-dashboard-clinicalsection-tsx
---
# Design Critique: apps/web/src/components/dashboard/ClinicalSection.tsx

## Design Health Score

| # | Heuristic | Score | Key Issue / Status |
|---|---|---|---|
| 1 | Visibility of System Status | 1/4 | Unresolved. The biomarker health balance and timeline tracker are entirely static. The SVG path has a hardcoded dasharray for `healthScore`, which defaults to 100 if the list of biomarkers is empty, potentially misleading users without presenting loading or processing indicators. |
| 2 | Match System / Real World | 2/4 | Unresolved. The date formats are hardcoded to `toLocaleDateString('en-GB')` rather than honoring user settings. A highly dangerous regex `replace(/undefined/gi, 'elevated')` is used in a text cleaning helper, which intercepts coding bugs (JS undefined) and prints them as clinical conditions ("elevated"). |
| 3 | User Control and Freedom | 1/4 | Unresolved. The patient profile card includes buttons to "Add Weight" and "Add Height", but they are styling-only templates with no logic or click handlers. The user cannot actually perform these tasks, or escape/cancel once clicked. |
| 4 | Consistency and Standards | 1/4 | Unresolved. The UI mixes Tailwind CSS classes, custom CSS variables, and hardcoded inline styling. Visual rounding is inconsistent, and standard CSS variable values are bypassed in favor of raw hex codes. |
| 5 | Error Prevention | 1/4 | Unresolved. The system masks raw undefined data elements by converting them to the clinical word "elevated", preventing detection of data pipeline issues. Fallbacks for missing fields are hardcoded inline ("Unknown", "N/A"), and date analysis defaults to today's date (`new Date()`) instead of actual report metadata. |
| 6 | Recognition Rather Than Recall | 2/4 | Unresolved. Essential information is scattered across fragmented grid cards. Text sizes are extremely small (8px-11px), forcing the user to strain their eyes. The timeline instructions are hardcoded and do not change. |
| 7 | Flexibility and Efficiency | 1/4 | Unresolved. The clinical viewer is entirely static. There is no ability to search, filter (e.g., view only flagged biomarkers), sort, or toggle categories. |
| 8 | Aesthetic and Minimalist Design | 1/4 | Unresolved. Violates the project's design standards (`Flat-By-Default` rule). The component is cluttered with glassmorphic cards, drop shadows, nested containers with multiple background color-mix variations, and double-nested borders. |
| 9 | Error Recovery | 1/4 | Unresolved. Because the data cleaning helper silently translates undefined data values into clinical words ("elevated"), users and developers cannot diagnose or recover from underlying data schema/ingestion errors. |
| 10 | Help and Documentation | 1/4 | Unresolved. The "Related Research" block contains a hardcoded message: "No related medical literature found for these biomarkers." No documentation, search functionality, or contextual definitions are provided for clinical terms. |
| **Total** | | **12/40** | **Poor / Critical Redesign Required** |

## Anti-Patterns Verdict

* **LLM Assessment**: Fail. The ClinicalSection component violates multiple styling, design token, accessibility, and architectural standards:
  * **Hardcoded Colors**: Fail. Uses hardcoded colors (like background gradients `#0d4a3a`, `#0a6b4f` on line 224, orange SVG stroke `#f5a623` on line 242, and translucent inline rgba colors on lines 225, 234, 263, 267, 271, 372, 385, and 399).
  * **Glassmorphism & Shadows (Violates Flat-By-Default Rule)**: Fail. Employs `glass-card` combined with `shadow-sm` and custom borders on lines 160, 192, 281, 339, 420, 435, and 458 instead of flat `border-border` boundaries and solid `bg-card` layouts.
  * **Nested Cards**: Fail. In the "Clinical Interpretation" block (lines 281-334), "Primary Narrative Summary" and "Systemic Observations" boxes are styled as nested cards. The "Pay Attention" card (lines 370-414) nests individual items with borders inside the main orange border card.
  * **Accessibility Bounds (Typography Sizes)**: Fail. Uses illegible text sizes below the minimum recommended font size of 12px, including `text-[8px]` (line 249), `text-[9px]` (lines 265, 269, 273, 445), `text-[10px]` (lines 169, 173, 177, 183, 201, 205, 209, 213, 288, 378), and `text-[11px]` (lines 299, 314, 449).
* **Deterministic Scan**: CLI scan detected multiple anti-patterns including hardcoded colors and nested card configurations.

## Overall Impression
The `ClinicalSection` component represents a severe usability and structural regression. It violates the core design rules established in `DESIGN.md`, such as the flat-by-default standard, and suffers from a highly fragmented typography scale that hinders accessibility. Crucially, the component contains a dangerous clinical data translation helper that masks programming errors (`undefined`) as active medical anomalies (`elevated`), introducing high-risk clinical misinformation.

## What's Working
1. **Grid Layout**: The basic two-column layout grid for patient details and laboratory info is organized logically.
2. **Biomarker Mapping**: Transforming short category names to friendly names (e.g., `CBC` to `Complete Blood Count`) provides a cleaner presentation of data panels.

## Priority Issues

* **[P0] Clinical Hazard & Code Smell (JavaScript Error Masking)**
  * **Why it matters**: The `cleanText` helper (line 29) replaces occurrences of `"undefined"` with `"elevated"`. This masks database or extraction pipeline null references and turns software bugs into false medical findings.
  * **Fix**: Remove the regex replacement of `undefined` with `elevated`. Revert to safe system fallbacks and standard error boundary handling.

* **[P1] Hardcoded Colors and Gradient Backgrounds**
  * **Why it matters**: Multiple elements use raw hex values (`#0d4a3a`, `#0a6b4f`, `#f5a623`) and custom `rgba` colors, which do not scale across light/dark modes and violate the visual design token system.
  * **Fix**: Map all gradients, borders, and text colors to semantic CSS variables such as `var(--primary)`, `var(--border)`, or standard `color-mix` utility functions.

* **[P1] Glassmorphism and Nested Cards (Violates Flat-By-Default Rule)**
  * **Why it matters**: Use of glassmorphism overlays and nested cards creates a cluttered, visually busy interface with overlapping borders and shadows.
  * **Fix**: Refactor the container elements to be flat by default (`border-border`), remove drop shadows (`shadow-sm`), and replace nested cards with flat rows or simple horizontal hairline dividers.

* **[P1] Accessibility Violation (Sub-Pixel Font Sizes)**
  * **Why it matters**: Use of `8px`, `9px`, and `10px` font sizes makes critical metadata and labels completely illegible for many users and fails basic WCAG readability criteria.
  * **Fix**: Upgrade the typography scale to ensure the absolute minimum text size is `12px` (`text-xs`), and body copy is at least `14px` (`text-sm`).

* **[P2] Non-Functional Action Elements**
  * **Why it matters**: Buttons like "Add Weight" and "Add Height" are present but have no click handlers or interaction logic, frustrating users.
  * **Fix**: Connect the buttons to form modals or deactivate them when not supported.
