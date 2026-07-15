"""
LLM-based clinical insight generator.

Takes a list of normalized biomarkers and produces 2–4 short, human-readable
insights matching the frontend `Insight` shape: { id, title, body, tone }
where tone ∈ {"positive", "watch", "neutral"}.

Tone semantics:
  - positive: a biomarker is in range and worth calling out
  - watch:    out of range or trending in a concerning direction
  - neutral:  borderline / informational

Body text MUST avoid prescriptive language — observations + suggested
follow-up framing only. This is not medical advice.
"""

import json
import logging
import uuid
from typing import Any

from .openai_client import OPENAI_AVAILABLE, OPENAI_MODEL, get_openai_client
from .mistral_client import MISTRAL_AVAILABLE, MISTRAL_MODEL, get_mistral_client

logger = logging.getLogger(__name__)

MAX_BIOMARKERS_TO_SEND = 60

_SYSTEM_PROMPT = (
    "You are a careful clinical analyst writing concierge-style summaries for "
    "a physician reviewing a patient's lab panel. Given a list of normalized "
    "biomarkers (with reference ranges and a LOW/NORMAL/HIGH/CRITICAL status), "
    "produce 2–4 insights that surface the most clinically meaningful patterns.\n\n"
    "Rules:\n"
    "  - Each insight MUST cite the specific biomarker(s) and values it refers to.\n"
    "  - Never invent values, trends, or history. You only see the current panel.\n"
    "  - Never give a diagnosis or prescription. Frame action as 'consider', "
    "'worth follow-up', or 'reassess'.\n"
    "  - Title: short, 4–10 words, no period at the end.\n"
    "  - Body: one or two sentences, ~25–55 words.\n"
    "  - Tone must be one of: 'positive' (in-range value worth noting), 'watch' "
    "(out of range or borderline that deserves attention), 'neutral' "
    "(informational, no action).\n"
    "  - Prefer insights that group related markers (e.g. lipid panel, glucose "
    "+ HbA1c) over per-marker recap.\n"
    "  - If nothing notable, return one neutral insight saying so."
)

_INSIGHT_SCHEMA: dict[str, Any] = {
    "name": "InsightSet",
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "insights": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "title": {"type": "string"},
                        "body": {"type": "string"},
                        "tone": {
                            "type": "string",
                            "enum": ["positive", "watch", "neutral"],
                        },
                    },
                    "required": ["title", "body", "tone"],
                },
            }
        },
        "required": ["insights"],
    },
    "strict": True,
}


def _format_biomarkers(biomarkers: list[dict]) -> str:
    """Compact tabular representation to keep token usage low."""
    lines = []
    for b in biomarkers[:MAX_BIOMARKERS_TO_SEND]:
        lines.append(
            f"- {b.get('display_name', b.get('canonical_name', '?'))}: "
            f"{b.get('value', '?')} {b.get('unit', '')} "
            f"(ref: {b.get('reference_range', 'n/a')}, "
            f"status: {b.get('status', 'NORMAL')})"
        )
    return "\n".join(lines)


def generate_insights(biomarkers: list[dict]) -> list[dict]:
    """Generate per-report insights. Returns [] when input is empty or LLM unavailable."""
    if not biomarkers:
        return []

    if MISTRAL_AVAILABLE:
        client = get_mistral_client()
        model = MISTRAL_MODEL
        client_name = "Mistral"
    elif OPENAI_AVAILABLE:
        client = get_openai_client()
        model = OPENAI_MODEL
        client_name = "OpenAI"
    else:
        logger.warning("Neither MISTRAL_API_KEY nor OPENAI_API_KEY set — skipping LLM insight generation")
        return []

    if client is None:
        return []

    biomarker_block = _format_biomarkers(biomarkers)

    try:
        resp = client.chat.completions.create(
            model=model,
            temperature=0.3,
            response_format={"type": "json_schema", "json_schema": _INSIGHT_SCHEMA},
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Normalized biomarker panel:\n\n{biomarker_block}",
                },
            ],
        )
    except Exception as e:
        logger.error("%s insight generation failed: %s", client_name, e, exc_info=True)
        return []

    raw = resp.choices[0].message.content or "{}"
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error("Insight LLM returned invalid JSON: %s — raw=%r", e, raw[:200])
        return []

    items = parsed.get("insights", [])
    if not isinstance(items, list):
        return []

    result: list[dict] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title", "")).strip()
        body = str(item.get("body", "")).strip()
        tone = str(item.get("tone", "neutral")).strip().lower()
        if tone not in ("positive", "watch", "neutral"):
            tone = "neutral"
        if not title or not body:
            continue
        result.append({
            "id": f"i-{uuid.uuid4().hex[:8]}",
            "title": title,
            "body": body,
            "tone": tone,
        })

    logger.info("LLM generated %d insights", len(result))
    return result
