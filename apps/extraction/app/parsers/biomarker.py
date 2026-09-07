"""
LLM-based biomarker parser.

Pulls structured {name, value, unit} tuples out of free-form medical report
text using OpenAI Structured Outputs. Canonical names are passed in as hints
so the model normalizes naming on its own; the downstream normalizer still
handles aliases, unit conversion, and status.
"""

import json
import logging
from typing import Any

from .openai_client import OPENAI_AVAILABLE, OPENAI_MODEL, get_openai_client
from .mistral_client import MISTRAL_AVAILABLE, MISTRAL_MODEL, get_mistral_client

logger = logging.getLogger(__name__)

MAX_INPUT_CHARS = 18_000


def _build_system_prompt(canonical_hints: list[str]) -> str:
    hint_block = ", ".join(canonical_hints[:80])
    return (
        "You extract structured biomarker measurements from medical lab report "
        "text. Return ONLY entries that are explicitly present in the text — "
        "never invent values, never include qualitative results (e.g. 'positive', 'negative', 'detected').\n\n"
        "For each biomarker measurement you find, return:\n"
        "  - name: the biomarker name as written, lowercase, no punctuation. "
        "Prefer one of the canonical names below when the text matches one of "
        "them; otherwise return the most common short form.\n"
        "  - value: the numeric value as a string (e.g. '5.4', '120'). Use only "
        "the value, no units, no operators ('<', '>'), no ranges.\n"
        "  - unit: the unit as written (e.g. 'mg/dL', 'mmol/L', '%', 'g/dL'). "
        "If absent, return an empty string.\n"
        "  - reference_min: the lower bound of the reference range as a number/float (e.g. 12.0 for '12.0 - 16.0'). If absent or there is no lower bound, return null.\n"
        "  - reference_max: the upper bound of the reference range as a number/float (e.g. 16.0 for '12.0 - 16.0', or 130 for '< 130'). If absent or there is no upper bound, return null.\n\n"
        "Skip any line you are unsure about. Skip patient demographics, dates, "
        "doctor notes, footers, page numbers.\n\n"
        f"Known canonical biomarker names you may encounter (use these when "
        f"possible): {hint_block}"
    )


_BIOMARKER_SCHEMA: dict[str, Any] = {
    "name": "BiomarkerExtraction",
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "biomarkers": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "name": {"type": "string"},
                        "value": {"type": "string"},
                        "unit": {"type": "string"},
                        "reference_min": {"type": ["number", "null"]},
                        "reference_max": {"type": ["number", "null"]},
                    },
                    "required": ["name", "value", "unit", "reference_min", "reference_max"],
                },
            }
        },
        "required": ["biomarkers"],
    },
    "strict": True,
}


def _llm_candidates() -> list[tuple[Any, str, str]]:
    """Return ordered list of (client, model, provider_name) candidates: OpenAI primary -> Mistral fallback."""
    candidates = []
    if OPENAI_AVAILABLE:
        client = get_openai_client()
        if client is not None:
            candidates.append((client, OPENAI_MODEL, "OpenAI"))
    if MISTRAL_AVAILABLE:
        client = get_mistral_client()
        if client is not None:
            candidates.append((client, MISTRAL_MODEL, "Mistral"))
    return candidates


def extract_biomarkers_llm(
    text: str,
    canonical_hints: list[str] | None = None,
) -> list[dict]:
    """Extract {name, value, unit, reference_min, reference_max} records from report text via LLM.

    Tries OpenAI primary -> Mistral fallback. Returns [] when neither is configured
    or all calls fail — callers MUST treat that as 'no biomarkers found', not a hard error.
    """
    candidates = _llm_candidates()
    if not candidates:
        logger.warning("Neither OpenAI nor Mistral configured/initialized — skipping LLM biomarker extraction")
        return []

    if not text or not text.strip():
        return []

    payload = text[:MAX_INPUT_CHARS]
    if len(text) > MAX_INPUT_CHARS:
        logger.info(
            "Truncating extraction text from %d → %d chars for LLM call",
            len(text),
            MAX_INPUT_CHARS,
        )

    hints = canonical_hints or []

    for client, model, client_name in candidates:
        try:
            resp = client.chat.completions.create(
                model=model,
                temperature=0,
                response_format={"type": "json_schema", "json_schema": _BIOMARKER_SCHEMA},
                messages=[
                    {"role": "system", "content": _build_system_prompt(hints)},
                    {"role": "user", "content": payload},
                ],
            )
            raw = resp.choices[0].message.content or "{}"
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError as e:
                logger.error("%s returned invalid JSON: %s — raw=%r", client_name, e, raw[:200])
                continue

            biomarkers = parsed.get("biomarkers", [])
            if not isinstance(biomarkers, list):
                logger.warning("%s returned non-list biomarkers field: %r", client_name, type(biomarkers))
                continue

            cleaned: list[dict] = []
            for b in biomarkers:
                if not isinstance(b, dict):
                    continue
                name = str(b.get("name", "")).strip()
                value = str(b.get("value", "")).strip()
                unit = str(b.get("unit", "")).strip()
                ref_min = b.get("reference_min")
                ref_max = b.get("reference_max")
                if not name or not value:
                    continue
                cleaned.append({
                    "name": name,
                    "value": value,
                    "unit": unit,
                    "reference_min": float(ref_min) if ref_min is not None else None,
                    "reference_max": float(ref_max) if ref_max is not None else None,
                })

            logger.info("%s extracted %d biomarker candidates", client_name, len(cleaned))
            return cleaned

        except Exception as e:
            logger.warning(
                "%s biomarker extraction failed, attempting fallback if available: %s",
                client_name,
                e,
            )

    logger.error("All LLM providers failed for biomarker extraction")
    return []
