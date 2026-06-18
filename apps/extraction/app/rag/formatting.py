"""Shared biomarker formatting.

Single source of truth for rendering a biomarker dict to a human-readable line.
Ingestion emits snake_case (`display_name`, `reference_range`) while the chat
request path emits camelCase (`displayName`, `referenceRange`); this coalesces
both so the two call sites can never silently diverge.
"""


def _first(b: dict, *keys, default=None):
    for k in keys:
        v = b.get(k)
        if v not in (None, ""):
            return v
    return default


def format_biomarker_line(b: dict) -> str:
    """Render one biomarker as ``- Name: value unit — STATUS (Ref: range)``."""
    name = _first(b, "display_name", "displayName", "canonical_name", "canonicalName", default="Unknown")
    val = _first(b, "value", default="N/A")
    unit = _first(b, "unit", default="")
    status = _first(b, "status", default="NORMAL")
    ref = _first(b, "reference_range", "referenceRange")
    ref_str = f" (Ref: {ref})" if ref else ""
    return f"- {name}: {val} {unit} — {status}{ref_str}"
