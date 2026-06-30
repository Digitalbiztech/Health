---
name: Auriem Clinical Suite
description: Calming, clinical, and human design system for medical lab reports.
colors:
  background: "#ffffff"
  foreground: "#111827"
  primary: "#D4BDAD"
  primary-text: "#8A7A6A"
  secondary: "#f3f4f6"
  muted: "#fbfaf9"
  border: "#e5e7eb"
  input: "#f3f4f6"
  ring: "#0891b2"
  accent: "#B8A89A"
  destructive: "#ef4444"
  status-normal: "#1A9966"
  status-high: "#F04E14"
  status-low: "#C97D0A"
  status-critical: "#D41717"
typography:
  display:
    fontFamily: "system-ui, -apple-system, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 3.5rem)"
    fontWeight: 700
    lineHeight: 1.15
  headline:
    fontFamily: "system-ui, -apple-system, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
  title:
    fontFamily: "system-ui, -apple-system, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.05em"
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
    rounded: "{rounded.lg}"
    padding: "10px 24px"
  button-primary-hover:
    backgroundColor: "{colors.primary-text}"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "10px 24px"
  card:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.lg}"
    padding: "24px"
  input:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
---

# Design System: Auriem Clinical Suite

## 1. Overview

**Creative North Star: "The Compassionate Sanctuary"**

The Auriem Clinical Suite balances strict scientific precision with soft, supportive medical care. It is built to serve two core users in a medical context: clinicians who require high-density, legible data directories, and patients who require a calming, reassuring space to review their health summaries. By avoiding sterile clinical coldness and tech-heavy SaaS clutter, it instills trust and clarity when interpreting vital biomarker metrics.

This system explicitly rejects the cold, sterile blue-gray grids of traditional hospital systems, as well as the neon-accented, over-animated, and hyper-dense patterns of generic developer tools.

**Key Characteristics:**
- Warm-neutral gold and sand tones anchoring a clean clinical white backing.
- Structured, predictable hierarchy with clear section dividers.
- High-contrast typography designed to be highly legible for elderly patients.
- Minimalist, purpose-driven interactions that respond immediately without flashing or distracting.

## 2. Colors

Warm-neutral medical brand ("Warm Oakwood & Clinical Linen") with a clean clinical white background, switching to a deep navy-slate base with electric cyan primary in dark mode.

### Primary
- **Warm Oakwood** (#D4BDAD / oklch(79.79% 0.046 66.86)): Used as the primary brand color for highlights, upload zones, primary buttons, and borders.
- **Warm Brown** (#8A7A6A / oklch(54.49% 0.038 67.57)): Secondary brand accent, used for text headers, active states, and clinical chat branding.

### Neutral
- **Clinical Linen Background** (#ffffff): Main application canvas background.
- **Charcoal Foreground** (#111827): Dominant ink color for text to ensure high legibility.
- **Warm Muted Fill** (#fbfaf9): Alternating background fills and cards.
- **Clean Gray Border** (#e5e7eb): Structural grid borders.

### Named Rules
**The Accented Rarity Rule.** Brand colors (Warm Oakwood and Warm Brown) must be used on ≤10% of any given screen. Visual noise is a failure; accents must call attention to key actions or status summaries, never serve as decorative backdrops.
**The High-Contrast Contrast Rule.** All body copy and status badges must maintain a minimum contrast ratio of 4.5:1 against their backgrounds. Light gray text is prohibited.

## 3. Typography

**Display Font:** System Font Stack (system-ui, -apple-system, sans-serif)
**Body Font:** System Font Stack (system-ui, -apple-system, sans-serif)

**Character:** The typography relies on a clean, humanist system font stack with specific OpenType feature sets (`cv02 cv03 cv04 cv11`) to maximize legibility and shape distinct character alignments.

### Hierarchy
- **Display** (Bold, clamp(2.25rem, 5vw, 3.5rem), 1.15): Used strictly for page-level hero titles and big metrics.
- **Headline** (SemiBold, 1.5rem, 1.25): Section-level titles (e.g., patient records panel, biomarker details).
- **Title** (SemiBold, 1.125rem, 1.5): Container sub-sections and card headers.
- **Body** (Regular, 0.875rem, 1.5): Standard narrative copy and patient-friendly explanations. Max line length is restricted to 65–75ch for optimal reading ease.
- **Label** (Bold, 0.75rem, tracking-wider, uppercase): Eyebrows, status badges, table headers, and sidebar descriptors.

### Named Rules
**The Anti-Eyebrow Rule.** Uppercase tracked eyebrows are permitted only on standalone dashboard labels and must never be placed above every single section header. Rhythm, spacing, and font weight must carry the section hierarchy.

## 4. Elevation

The Auriem Clinical Suite relies on flat, tactile layering using clean borders and background shifts. It rejects decorative glass blurs or arbitrary floating elements.

### Shadow Vocabulary
- **Tactile Resting** (`box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06)`): Default card and container boundary shadow.
- **Interactive Focus** (`box-shadow: 0 10px 15px rgba(0, 0, 0, 0.08)`): Applied on active upload zones or focused hover states.

### Named Rules
**The Flat-By-Default Rule.** Elements must rest flat on the canvas. Shadows are reserved purely to signal active state feedback (hover, focus, or modal overlay stacking).

## 5. Components

### Buttons
- **Shape:** Softly rounded corners (12px radius).
- **Primary:** Flat Warm Oakwood (#D4BDAD) fill with white text. Padding is 10px vertically, 24px horizontally.
- **Hover / Focus:** Transitions smoothly to Warm Brown (#8A7A6A) on hover, with a teal focus ring (var(--ring)) on keyboard focus.

### Cards / Containers
- **Corner Style:** Rounded corners (12px radius).
- **Background:** Crisp White (#ffffff) on Muted Fill (#fbfaf9).
- **Shadow Strategy:** Resting flat shadow (`0 1px 3px rgba(0, 0, 0, 0.06)`).
- **Border:** Hair-thin borders (`1px solid #e5e7eb`).
- **Internal Padding:** Generous padding (24px).

### Inputs / Fields
- **Style:** Clean borders with a subtle warm background fill, using a 12px corner radius.
- **Focus:** Focus ring triggers a solid teal border change and outer ring shadow.

### Navigation
- **Style:** Flat top header or sidebar with transparent backings, using system icons. Active items are represented by a solid Warm Brown fill or text color change, never a floating colored dot.

## 6. Do's and Don'ts

### Do:
- **Do** maintain strict line length restrictions of 65-75ch on all patient insights blocks to prevent reading fatigue.
- **Do** ensure status badges use high-contrast text overlaying light status fills (e.g. status-critical text on status-critical-bg).
- **Do** use responsive flex layouts for visual sliders and charts rather than fixed pixel dimensions.

### Don't:
- **Don't** use side-stripe borders (e.g. thick border-left) as callout indicators on patient cards. Use full borders or background fills instead.
- **Don't** use gradient text under any circumstances; keep display elements solid and clean.
- **Don't** animate image cards or charts on hover; hover animations must be limited to button text shifts, background colors, and outline focus states.
- **Don't** stack card boundaries inside other card boundaries.
