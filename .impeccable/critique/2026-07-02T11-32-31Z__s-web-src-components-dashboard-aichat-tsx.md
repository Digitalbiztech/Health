---
target: apps/web/src/components/dashboard/AIChat.tsx
total_score: 26
p0_count: 0
p1_count: 3
timestamp: 2026-07-02T11-32-31Z
slug: s-web-src-components-dashboard-aichat-tsx
---
# Design Critique: apps/web/src/components/dashboard/AIChat.tsx

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3/4 | Load spinner and generation text appear during AI replies, but the initial patient history load fails to display system-level loaders/skeletons. |
| 2 | Match System / Real World | 3/4 | Strong contextual greetings/actions for Doctor vs. Patient, though references would benefit from standard medical citations format. |
| 3 | User Control and Freedom | 2/4 | Users can start threads and toggle the sidebar, but they cannot rename, delete, or archive old chat sessions. |
| 4 | Consistency and Standards | 3/4 | Standard CSS theme colors/variables are used, and resting shadows are omitted. Typographic scale is corrected (14px body / 12px secondary). |
| 5 | Error Prevention | 2/4 | The "Download PDF Summary" action continues to use a fragile DOM-selector crawling query: `document.querySelector('[class*="export"]')`. |
| 6 | Recognition Rather Than Recall | 2/4 | Header displays static role titles rather than the active session title. |
| 7 | Flexibility and Efficiency | 2/4 | Center suggestion pills offer shortcuts, but keyboard accelerators or advanced compose formatting tools are absent. |
| 8 | Aesthetic and Minimalist Design | 4/4 | All resting container shadows and double-nested card backgrounds/borders have been successfully flattened. Typography sizes are balanced. |
| 9 | Error Recovery | 2/4 | Reply errors show fallback bubbles, but sidebar loads and session creations fail silently in console. |
| 10 | Help and Documentation | 3/4 | A clear, permanent medical safety disclaimer has been added to the bottom of the chat panel. |
| **Total** | | **26/40** | **Good** |

## Anti-Patterns Verdict

* **LLM Assessment**: Pass. All slop tells and layout clichés have been successfully resolved:
  * **WCAG AA Contrast**: Resolved. Hardcoded colors have been replaced with theme-aware status variables that exceed 4.5:1 contrast against light card backings.
  * **Glassmorphism & Shadows**: Resolved. Resting containers are flat-by-default with thin borders (`border-border`), aligning with DESIGN.md rules.
  * **Nested Card Boundaries**: Resolved. Expanded References container uses border-t line separator instead of rendering separate nested card background.
* **Deterministic Scan**: CLI scan found 0 anti-patterns (no raw syntax issues matched).

## Overall Impression
The AIChat now presents a polished and accessible conversational copilot. The visual noise, SaaS shadows, and nested card borders have been successfully distilled to a clean, flat aesthetic. Visual hierarchy is much more readable with standard text sizes and a dedicated medical safety disclaimer.

## What's Working
1. **Clean Flat Layout**: Sidebar and chat bubbles snap to flat styles, aligning with Auriem Suite branding.
2. **Accessible Typographic Scale**: Set bubbles body copy to text-sm and lists to text-xs, making reading long messages highly comfortable.
3. **Medical Safety Disclaimer**: The disclaimer added at the bottom provides a clear clinical grounding context.
