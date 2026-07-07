---
target: apps/web/src/components/dashboard/AIChat.tsx
total_score: 22
p0_count: 1
p1_count: 2
timestamp: 2026-07-02T16-52-32Z
slug: s-web-src-components-dashboard-aichat-tsx
---
# Design Critique: apps/web/src/components/dashboard/AIChat.tsx

## Design Health Score

| # | Heuristic | Score | Key Issue / Status |
|---|---|---|---|
| 1 | Visibility of System Status | 3/4 | Improved. The `loading` state is set during thread initialization and history fetches, which disables buttons and displays a loading block at the bottom of the chat panel. However, the generic AI response loader message ("Analyzing diagnostic parameters...") is hardcoded and also displays during session load, which can be slightly confusing. |
| 2 | Match System / Real World | 3/4 | Good. The interface distinguishes between Doctor and Patient contexts by tailoring greetings, action tools, and suggested question shortcuts. Formatting scientific references as standard citations could improve the match. |
| 3 | User Control and Freedom | 2/4 | No change. Users can toggle the sidebar and start new consultation threads, but there is still no capability to rename or delete old chat sessions, leading to permanent sidebar clutter. |
| 4 | Consistency and Standards | 2/4 | Partially resolved. The component now utilizes `var(--status-normal)` instead of the hardcoded `#10b981` color, and respects the "Flat-By-Default Rule" by removing resting box shadows. However, it still violates the typographic scale with under-sized fonts (9px to 11px) and uses body text at `text-xs` (12px) instead of the standard `text-sm` (14px). |
| 5 | Error Prevention | 2/4 | Unresolved. The "Download PDF Summary" action continues to use a fragile DOM selector querying hack (`document.querySelector('[class*="export"]')`) to programmatically trigger a download, which will break if the external layout class shifts or is minified. |
| 6 | Recognition Rather Than Recall | 2/4 | Unresolved. While the sidebar shows past threads, the main panel header does not display the active thread's title. If the sidebar is closed, the user must remember which session is currently active. |
| 7 | Flexibility and Efficiency | 2/4 | Unresolved. Centered suggested questions pills provide useful shortcuts, but the interface lacks keyboard accelerators (e.g., sidebar toggle, thread creation) or accelerators like markdown preview or attachments. |
| 8 | Aesthetic and Minimalist Design | 3/4 | Improved. Resting shadows are removed, and the Clinician Tools/Actionable Steps section has been flattened to a single top border instead of a double-nested card. However, the References block still renders a card container (`border border-border/40 bg-muted/20`) nested inside the assistant bubble when expanded, and readability is congested due to small font sizes. |
| 9 | Error Recovery | 2/4 | Unresolved. API message delivery failures display a fallback bubble, but errors in loading session history or starting a new session fail silently in the console without user-facing notification or a retry action. |
| 10 | Help and Documentation | 1/4 | Unresolved. The interface lacks an AI clinical safety disclaimer or boundary notice under the input panel, which is crucial for medical compliance and managing diagnostic anxiety. |
| **Total** | | **22/40** | **Fair** |

## Anti-Patterns Verdict

* **LLM Assessment**: Fail. The AIChat component has resolved some critical design system conflicts, but still violates typographic and structural rules in `DESIGN.md`:
  * **Hardcoded Colors**: Resolved. The hardcoded status color has been replaced with `var(--status-normal)`, allowing proper theme adaptation.
  * **Glassmorphism & Shadows (Violates Flat-By-Default Rule)**: Resolved. The resting container shadows (`shadow-md` and `shadow-sm`) have been removed. The layout relies on flat borders (`border-border`), aligning with the design system.
  * **Nested Cards**: Partially Resolved. The Clinician Tools block was flattened, but the references section still renders a nested border/background container inside the assistant's message bubble once expanded.
  * **Accessibility Bounds (Typography Sizes)**: Unresolved. The component still uses text sizes of `9px`, `10px`, and `11px` for sub-elements (references, dates, suggested questions) and `text-xs` (12px) for main message paragraphs, violating the typographic scale where body copy should be `text-sm` (14px) and labels/badges `text-xs` (12px).
  * **Uppercase Tracked Eyebrows (Violates Anti-Eyebrow Rule)**: Partially Resolved. Removed from subheadings like Clinician Tools, but still present in markdown `h3` components and the references toggle button.
* **Deterministic Scan**: CLI scan found 0 anti-patterns (no raw syntax issues matched).

## Overall Impression
The AIChat component is moving in the right direction. By removing resting shadows, hardcoded colors, and flattening the Clinician Tools block, it aligns much better with the core aesthetic of the Auriem Clinical Suite. However, severe typography scale violations (using 9px-11px text and 12px body copy) and structural issues (fragile DOM selectors, lack of thread management, and missing disclaimer) prevent it from feeling like a fully accessible and polished clinical assistant.

## What's Working
1. **Flat Layout Migration**: Removing the resting shadow and glassmorphism elements has immediately made the container feel lighter and cleaner.
2. **Flattened Tools Section**: The Clinician Tools block is separated by a clean top divider, avoiding double-nested cards.
3. **Responsive Online Indicator**: Using custom variables allows the online indicator to adapt to the active theme palette.

## Priority Issues

* **[P0] Accessibility Legibility & Contrast (Tiny Typography)**
  * **Why it matters**: The layout uses text sizes of `9px`, `10px`, and `11px` for critical information (such as references, clipboard tools, dates, and suggested questions) and `text-xs` (12px) for main message paragraphs. This violates basic legibility standards and degrades accessibility, especially for patient cohorts who might have visual impairments.
  * **Fix**: Elevate body font sizes to standard `text-sm` (0.875rem / 14px) and secondary labels/buttons to `text-xs` (0.75rem / 12px) as specified in `DESIGN.md`.

* **[P1] Structural Code Smell (Fragile DOM Querying)**
  * **Why it matters**: The "Download PDF Summary" action (lines 109 and 140) uses a direct DOM selector `document.querySelector('[class*="export"]')` to programmatically trigger a download. This is a fragile hack that tightly couples the chat component to class names of external elements and will fail if the class names are minified, missing, or updated.
  * **Fix**: Pass an explicit callback handler down as a prop, or trigger export through a unified context/store state instead of crawling the DOM.

* **[P1] Lack of Session Thread Management**
  * **Why it matters**: There are no controls to rename or delete threads from the chat sidebar, leading to a cluttered sidebar interface that limits user control.
  * **Fix**: Add rename/delete icons next to chat sessions in the sidebar list.

* **[P2] Nested Card Boundaries**
  * **Why it matters**: Renders panels for references inside chat message bubbles, leading to double-nested borders and backgrounds that clash with clean design principles.
  * **Fix**: Format references as flat dividers or borderless line lists within the bubble structure.

* **[P2] Missing Clinical Safety Disclaimer**
  * **Why it matters**: Medical AI chat assistants must display clear boundaries of capability and a medical disclaimer to manage patient anxiety and meet compliance/safety requirements.
  * **Fix**: Add a permanent clear clinical/AI safety disclaimer at the bottom of the chat container or within the onboarding interface.

## Persona Red Flags

* **Alex (Power User / Clinician)**: Frustrated by fragile DOM download hacks that might fail silently, and the inability to clean up/rename old threads, cluttering their dashboard consultation view.
* **Jordan (First-Time Patient)**: Suffers from eye strain trying to read tiny 9px/10px references or action steps on mobile/tablet views, and lacks clear medical disclaimers to reassure them that the AI is only a co-pilot, not a doctor.
