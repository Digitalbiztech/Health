---
target: apps/web/src/components/dashboard/AIChat.tsx
total_score: 26
p0_count: 0
p1_count: 2
timestamp: 2026-07-02T17-02-00Z
slug: s-web-src-components-dashboard-aichat-tsx
---
# Design Critique: apps/web/src/components/dashboard/AIChat.tsx

## Design Health Score

| # | Heuristic | Score | Key Issue / Status |
|---|---|---|---|
| 1 | Visibility of System Status | 3/4 | Neutral. The `loading` state is set during thread generation and reply fetching, disabling inputs and rendering a clear status spinner. However, the initial load of patient history lacks a system-level loader or skeleton screen, and loading messages are hardcoded. |
| 2 | Match System / Real World | 3/4 | Neutral. Adapts greetings, clinical tools, and suggested questions contextually to clinician (Doctor) vs. patient roles. Could present medical references in a cleaner standard citation format. |
| 3 | User Control and Freedom | 2/4 | Neutral. Users can toggle the history sidebar and start new consultation threads. However, there is still no interface action to rename, archive, or delete old sessions, leading to permanent sidebar list clutter. |
| 4 | Consistency and Standards | 3/4 | Improved. The component utilizes standard theme colors (like `var(--status-normal)`) and respects the "Flat-By-Default Rule" by omitting resting box shadows. The typographic scale has been corrected: body copy is now `text-sm` (14px) and labels/secondary triggers are `text-xs` (12px). Minor uppercase tracked text remains on custom h3 components and the references toggle button. |
| 5 | Error Prevention | 2/4 | Unresolved. The "Download PDF Summary" action continues to query the external layout DOM via a fragile class selector selector: `document.querySelector('[class*="export"]')`. This tightly couples the chat component to layout class names and will break if classes shift or are minified. |
| 6 | Recognition Rather Than Recall | 2/4 | Unresolved. The main chat header displays static titles rather than the active chat session's title. If the user collapses the sidebar, they must recall which session is currently active. |
| 7 | Flexibility and Efficiency | 2/4 | Neutral. Centered suggestion pills act as excellent accelerators for quick inquiries. However, the interface lacks basic keyboard shortcuts or markdown formatting helpers. |
| 8 | Aesthetic and Minimalist Design | 4/4 | Improved/Resolved. Resting card shadows have been removed. The clinician tools block is flattened, and the expanded references block has been cleaned up to use a flat top divider (`border-t border-border/40 pt-2.5 bg-transparent`) instead of a double-nested card boundary, removing all nested card layout violations. Typography sizes are well-balanced. |
| 9 | Error Recovery | 2/4 | Unresolved. API reply transmission errors display a fallback bubble, but failures during sidebar load, thread creation, or historical record fetch fail silently in console without user-facing alerts or retry actions. |
| 10 | Help and Documentation | 3/4 | Improved. A permanent, highly visible clinical safety disclaimer has been added to the bottom input panel, clearly communicating the AI's role as informational support and advising consultation with a healthcare provider. |
| **Total** | | **26/40** | **Fair-to-Good** |

## Anti-Patterns Verdict

* **LLM Assessment**: Pass. The AIChat component has resolved the critical visual styling and accessibility violations identified in the previous assessment:
  * **Hardcoded Colors**: Resolved. Hardcoded `#10b981` status color has been replaced with the standard CSS theme variable `var(--status-normal)`.
  * **Glassmorphism & Shadows (Violates Flat-By-Default Rule)**: Resolved. The resting container shadows (`shadow-md` and `shadow-sm`) have been removed, relying on flat `border-border` boundaries.
  * **Nested Cards**: Resolved. The clinician tools block and expanded references block have both been flattened to border-top separators with transparent backgrounds, resolving nested container styling rules.
  * **Accessibility Bounds (Typography Sizes)**: Resolved. Main message text sizes have been elevated from `text-xs` (12px) to standard `text-sm` (14px). Secondary elements, reference lists, and buttons are set to `text-xs` (12px), eliminating the illegible `9px-11px` blocks.
  * **Uppercase Tracked Eyebrows (Violates Anti-Eyebrow Rule)**: Partially Resolved. Removed from subheadings like Clinician Tools, but still present in markdown `h3` components and the references toggle button.
* **Deterministic Scan**: CLI scan found 0 anti-patterns.

## Overall Impression
The updated AIChat component shows significant improvement, raising its Design Health Score from 22/40 to 26/40. By elevating body copy to standard `text-sm` (14px) and secondary labels/reference text to `text-xs` (12px), readability and contrast have been restored. Stacking nested card containers inside message bubbles has been successfully resolved by shifting references to a flat top border divider. The inclusion of a clear medical safety disclaimer under the input panel resolves critical medical compliance concerns.

However, outstanding issues include the fragile DOM querying code smell for exporting report PDFs and the lack of sidebar thread management (delete/rename).

## What's Working
1. **Readable Typography Scale**: Message body text is highly legible, making reading clinical feedback much easier for patient personas.
2. **Flattened Containers**: Shifting references and tools to simple top dividers fits beautifully into the clinical aesthetic.
3. **Medical Safety Disclaimer**: The new input disclaimer establishes correct patient-co-pilot boundaries.

## Priority Issues

* **[P1] Structural Code Smell (Fragile DOM Querying)**
  * **Why it matters**: The "Download PDF Summary" action (lines 109 and 140) uses a direct DOM selector `document.querySelector('[class*="export"]')` to programmatically trigger a download. This is a fragile hack that will fail if the class names are minified, missing, or updated.
  * **Fix**: Pass an explicit callback handler down as a prop, or trigger export through a unified context/store state instead of crawling the DOM.

* **[P1] Lack of Session Thread Management**
  * **Why it matters**: There are no controls to rename or delete threads from the chat sidebar, leading to a cluttered sidebar interface.
  * **Fix**: Add rename/delete icons next to chat sessions in the sidebar list.

* **[P2] Active Thread Visibility**
  * **Why it matters**: The header does not display the active thread's title, forcing users to scan the sidebar to recall the active consultation.
  * **Fix**: Display the active session's title (e.g. `sessions.find(s => s.id === sessionId)?.title`) in the main chat panel header.
