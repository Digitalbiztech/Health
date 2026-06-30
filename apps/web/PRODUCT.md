# Product

## Register

product

## Users
Patients and clinicians/medical staff.
- **Patients**: Individuals reviewing their lab results, checking biomarker ranges, viewing historical trends, and asking questions to the AI clinical chat co-pilot. They need simplicity, clarity, reassurance, and readable fonts/contrast.
- **Clinicians & Staff**: Medical practitioners managing patient lists, onboarding new profiles, analyzing trends, comparing reports, and tracking daily tasks. They need efficiency, dense but clear dashboards, and high-trust clinical data presentation.

## Product Purpose
A full-stack clinical report processor and RAG-driven patient co-pilot designed to process raw lab PDFs, sanitize/mask PII, normalize biomarker data, and generate intuitive, print-safe clinical reports, side-by-side delta comparisons, and interactive chat summaries.

## Brand Personality
Calming, clinical, and human. Emphasizes clinical precision and expert confidence while remaining deeply reassuring and accessible for anxious patients.

## Anti-references
- **Sterile Blue/Gray Grids**: Avoid the cold, hospital-style aesthetic that increases patient anxiety.
- **Generic SaaS Dashboards**: Avoid cluttered, tech-heavy interfaces that prioritize visual noise over clinical readability.
- **Over-animated Transitions**: Avoid flashing elements or rapid motion that degrades usability or distracts from medical data.

## Design Principles
- **Clarity Over Novelty**: Medical information must always be readable, structured, and easy to interpret at first glance.
- **Dual-Lens Design**: Present data in a way that satisfies both clinical detail for practitioners and plain-language simplicity for patients.
- **Print-Safe Continuity**: Ensure screen visuals translate cleanly and without clipping to exportable formats like PDF.

## Accessibility & Inclusion
- **Contrast**: Strictly conform to WCAG AA guidelines with high-contrast text on warm-neutral and white backings, ensuring body text hits >= 4.5:1.
- **Typography**: Legible sizes and weights, with a maximum line length of 65-75ch for prose.
- **Motion**: Respect system motion settings using `@media (prefers-reduced-motion: reduce)` alternatives (crossfades/instant transitions).
