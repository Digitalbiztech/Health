---
target: apps/web/src/components/dashboard/AIChat.tsx
total_score: 18
p0_count: 1
p1_count: 2
timestamp: 2026-07-02T11-15-38Z
slug: s-web-src-components-dashboard-aichat-tsx
---
# Design Critique: apps/web/src/components/dashboard/AIChat.tsx

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2/4 | Chat replies show a loader spinner, but session switching/loading and new session creation happen without user-facing indicators, leaving the main chat panel blank/unresponsive during loading. |
| 2 | Match System / Real World | 3/4 | Differentiates roles appropriately (Doctor vs. Patient), but could present medical sources and guidelines in a cleaner real-world citation format. |
| 3 | User Control and Freedom | 2/4 | Users can start new threads and toggle the sidebar, but there is no mechanism to delete or rename existing chat sessions, leading to permanent session clutter. |
| 4 | Consistency and Standards | 1/4 | Violates multiple rules in `DESIGN.md`: uses resting shadows (`shadow-md`/`shadow-sm`) instead of flat borders, uses hardcoded colors (`#10b981`), violates typographic scale (under-sized fonts), and violates the Anti-Eyebrow rule. |
| 5 | Error Prevention | 2/4 | Includes basic checks to prevent blank messages, but uses a highly fragile DOM-querying hack (`document.querySelector('[class*="export"]')`) to trigger PDF downloads, which will break if layout or classes shift. |
| 6 | Recognition Rather Than Recall | 2/4 | Shows past sessions list, but does not display the active thread's title in the main panel header, forcing users to scan the sidebar to recall the active consultation. |
| 7 | Flexibility and Efficiency | 2/4 | Provides quick-suggested pills for shortcuts, but lacks keyboard shortcuts (e.g. for sidebar toggle, new thread) or standard chat accelerators like markdown preview or attachments. |
| 8 | Aesthetic and Minimalist Design | 1/4 | Significant visual clutter: double-nested card boundaries inside assistant message bubbles (references blocks and tools), and cramped legibility due to tiny font sizes (9px to 11px). |
| 9 | Error Recovery | 2/4 | API network errors for chat replies show a friendly fallback message, but failure to load the sidebar sessions or create a new session fails silently without recovery options. |
| 10 | Help and Documentation | 1/4 | Lacks a critical AI/clinical disclaimer or description of AI capability boundaries, which is crucial for medical safety, compliance, and managing patient anxiety. |
| **Total** | | **18/40** | **Poor** |

## Anti-Patterns Verdict

* **LLM Assessment**: Fail. The AIChat component features several visual and structural design issues that violate the core principles in `DESIGN.md`:
  * **Hardcoded Colors**: Violates CSS variable usage. Custom Tailwind hex value `#10b981` (Emerald 500 equivalent) is hardcoded for the "Online" status indicator instead of mapping to the status color variables like `var(--status-normal)`.
  * **Glassmorphism & Shadows (Violates Flat-By-Default Rule)**: Container uses resting shadows (`shadow-md` on line 361) and message bubbles use `shadow-sm` on resting views, which is prohibited under the Flat-By-Default rule (shadows must be reserved purely to signal active state feedback like hover, focus, or modal overlay stacking).
  * **Nested Card Boundaries**: Violates the "Don't stack card boundaries inside other card boundaries" rule. The references panel and clinician tools/actionable steps blocks are styled as card-like containers with solid/low-opacity backgrounds and borders, nested inside the assistant's message bubble card.
  * **Typography Font Sizes**: Under-sized elements (`text-[9px]`, `text-[10px]`, `text-[11px]`) violate the typography scale in `DESIGN.md`. Standard body text should be `text-sm` (14px) and labels `text-xs` (12px), but the chat bubbles use `text-xs` (12px) for body copy and sub-elements use `text-[9px]` or `text-[10px]`, degrading legibility and accessibility.
  * **Uppercase Tracked Eyebrows (Violates Anti-Eyebrow Rule)**: Places uppercase tracked eyebrows (`text-[10px] uppercase tracking-wider`) above multiple secondary panels/buttons instead of restricting them to standalone labels.
* **Deterministic Scan**: CLI scan found 0 anti-patterns (no raw syntax issues matched).

## Overall Impression
The AIChat component is a functional communication co-pilot, but it struggles with severe design system violations and visual clutter. By using flat, unintegrated box-shadows, stacking nested boxes inside bubbles, and shrinking typography down to an illegible 9px, the interface feels congested and resembles a generic chat widget rather than a premium, accessible clinical tool. Restoring flat borders, aligning with the typographic scale, and resolving the DOM-querying hack will dramatically improve legibility, stability, and aesthetic quality.

## What's Working
1. **Interactive Suggested Pills**: The role-aware suggested questions pills are centered and provide an excellent shortcut for patient and clinician engagement.
2. **Clear Chat Bubble Alignment**: Alternating left-aligned assistant bubbles and right-aligned user bubbles provides a natural visual reading flow.

## Priority Issues

* **[P0] Accessibility Legibility & Contrast (Tiny Typography)**
  * **Why it matters**: The layout uses text sizes of `9px`, `10px`, and `11px` for critical information (such as references, clipboard tools, dates, and suggested questions) and `text-xs` (12px) for main message paragraphs. This violates basic legibility standards and degrades accessibility, especially for patient cohorts who might have visual impairments.
  * **Fix**: Elevate body font sizes to standard `text-sm` (0.875rem / 14px) and secondary labels/buttons to `text-xs` (0.75rem / 12px) as specified in `DESIGN.md`.
  * **Suggested command**: `/impeccable typeset apps/web/src/components/dashboard/AIChat.tsx`

* **[P1] Design System Violations (Elevation & Eyebrows)**
  * **Why it matters**: Stacking `shadow-md` and `shadow-sm` on resting card views violates the "Flat-By-Default Rule" in `DESIGN.md`. Additionally, using uppercase tracked eyebrows above multiple inner elements violates the "Anti-Eyebrow Rule."
  * **Fix**: Revert resting container elements to thin borders (`border-border`) and solid backgrounds. Limit shadows to active elements (hover/focus). Adjust eyebrow styling to follow hierarchy.
  * **Suggested command**: `/impeccable quieter apps/web/src/components/dashboard/AIChat.tsx`

* **[P1] Structural Code Smell (Fragile DOM Querying)**
  * **Why it matters**: The "Download PDF Summary" action (lines 109 and 140) uses a direct DOM selector `document.querySelector('[class*="export"]')` to programmatically trigger a download. This is a fragile hack that tightly couples the chat component to class names of external elements and will fail if the class names are minified, missing, or updated.
  * **Fix**: Pass an explicit callback handler down as a prop, or trigger export through a unified context/store state instead of crawling the DOM.
  * **Suggested command**: `/impeccable refactor apps/web/src/components/dashboard/AIChat.tsx`

* **[P2] Nested Card Boundaries**
  * **Why it matters**: Renders panels for clinical tools and references inside chat message bubbles, leading to double-nested borders and backgrounds that clash with clean design principles.
  * **Fix**: Format references and clinical tool triggers as flat dividers or borderless line lists within the bubble structure.
  * **Suggested command**: `/impeccable distill apps/web/src/components/dashboard/AIChat.tsx`

* **[P2] Missing Clinical Safety Disclaimer**
  * **Why it matters**: Medical AI chat assistants must display clear boundaries of capability and a medical disclaimer to manage patient anxiety and meet compliance/safety requirements.
  * **Fix**: Add a permanent clear clinical/AI safety disclaimer at the bottom of the chat container or within the onboarding interface.
  * **Suggested command**: `/impeccable disclaimer apps/web/src/components/dashboard/AIChat.tsx`

* **[P3] Lack of Session Thread Management**
  * **Why it matters**: There are no controls to rename or delete threads from the chat sidebar, leading to a cluttered sidebar interface that limits user control.
  * **Fix**: Add rename/delete icons next to chat sessions in the sidebar list.
  * **Suggested command**: `/impeccable manage-threads apps/web/src/components/dashboard/AIChat.tsx`

## Persona Red Flags

* **Alex (Power User / Clinician)**: Frustrated by fragile DOM download hacks that might fail silently, and the inability to clean up/rename old threads, cluttering their dashboard consultation view.
* **Jordan (First-Time Patient)**: Suffers from eye strain trying to read tiny 9px/10px references or action steps on mobile/tablet views, and lacks clear medical disclaimers to reassure them that the AI is only a co-pilot, not a doctor.

## Minor Observations
* Using Tailwind `#10b981` instead of `--status-normal` breaks light/dark theme compliance and custom brand palette overrides.
* No option for printing the chat transcript directly, which some power users might require for record keeping.

## Questions to Consider
1. If the PDF download button class name changes in a future UI refactor, will the doctor be left wondering why the "Download PDF" button in the AI chat bubble does nothing?
2. How can we ensure patients do not confuse AI diagnostic suggestions with definitive doctor directives when we provide action buttons like "Schedule Appointment" directly under clinical analysis without a medical disclaimer?
3. In a workspace configured for clinical precision, why are we squeezing scientific reference text down to 10px, effectively signaling that the sources of medical truth are less important than UI whitespace?
