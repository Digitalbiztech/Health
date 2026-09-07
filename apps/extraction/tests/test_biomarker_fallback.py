"""Tests for OpenAI-first biomarker extraction and insight generation with Mistral fallback."""

import json
from unittest.mock import MagicMock, patch
import pytest

from app.parsers.biomarker import extract_biomarkers_llm
from app.parsers.insights import generate_insights


def _mock_chat_response(content_dict: dict):
    resp = MagicMock()
    choice = MagicMock()
    choice.message.content = json.dumps(content_dict)
    resp.choices = [choice]
    return resp


# ── Biomarker LLM Fallback Tests ────────────────────────────────────


def test_biomarker_primary_openai_success():
    openai_client = MagicMock()
    mistral_client = MagicMock()

    openai_client.chat.completions.create.return_value = _mock_chat_response({
        "biomarkers": [
            {
                "name": "glucose",
                "value": "95",
                "unit": "mg/dL",
                "reference_min": 70.0,
                "reference_max": 99.0,
            }
        ]
    })

    candidates = [
        (openai_client, "gpt-4o-mini", "OpenAI"),
        (mistral_client, "mistral-large-latest", "Mistral"),
    ]

    with patch("app.parsers.biomarker._llm_candidates", return_value=candidates):
        results = extract_biomarkers_llm("Glucose 95 mg/dL")

    assert len(results) == 1
    assert results[0]["name"] == "glucose"
    assert results[0]["value"] == "95"
    openai_client.chat.completions.create.assert_called_once()
    mistral_client.chat.completions.create.assert_not_called()


def test_biomarker_fallback_to_mistral_on_openai_error():
    openai_client = MagicMock()
    mistral_client = MagicMock()

    openai_client.chat.completions.create.side_effect = RuntimeError("OpenAI 429 Rate limited")
    mistral_client.chat.completions.create.return_value = _mock_chat_response({
        "biomarkers": [
            {
                "name": "hba1c",
                "value": "5.6",
                "unit": "%",
                "reference_min": 4.0,
                "reference_max": 5.7,
            }
        ]
    })

    candidates = [
        (openai_client, "gpt-4o-mini", "OpenAI"),
        (mistral_client, "mistral-large-latest", "Mistral"),
    ]

    with patch("app.parsers.biomarker._llm_candidates", return_value=candidates):
        results = extract_biomarkers_llm("HbA1c 5.6 %")

    assert len(results) == 1
    assert results[0]["name"] == "hba1c"
    assert results[0]["value"] == "5.6"
    openai_client.chat.completions.create.assert_called_once()
    mistral_client.chat.completions.create.assert_called_once()


def test_biomarker_fallback_on_invalid_json():
    openai_client = MagicMock()
    mistral_client = MagicMock()

    bad_resp = MagicMock()
    choice = MagicMock()
    choice.message.content = "Not valid JSON"
    bad_resp.choices = [choice]
    openai_client.chat.completions.create.return_value = bad_resp

    mistral_client.chat.completions.create.return_value = _mock_chat_response({
        "biomarkers": [
            {
                "name": "creatinine",
                "value": "0.9",
                "unit": "mg/dL",
                "reference_min": 0.6,
                "reference_max": 1.2,
            }
        ]
    })

    candidates = [
        (openai_client, "gpt-4o-mini", "OpenAI"),
        (mistral_client, "mistral-large-latest", "Mistral"),
    ]

    with patch("app.parsers.biomarker._llm_candidates", return_value=candidates):
        results = extract_biomarkers_llm("Creatinine 0.9 mg/dL")

    assert len(results) == 1
    assert results[0]["name"] == "creatinine"
    mistral_client.chat.completions.create.assert_called_once()


def test_biomarker_all_providers_fail():
    openai_client = MagicMock()
    mistral_client = MagicMock()

    openai_client.chat.completions.create.side_effect = RuntimeError("OpenAI down")
    mistral_client.chat.completions.create.side_effect = RuntimeError("Mistral 429")

    candidates = [
        (openai_client, "gpt-4o-mini", "OpenAI"),
        (mistral_client, "mistral-large-latest", "Mistral"),
    ]

    with patch("app.parsers.biomarker._llm_candidates", return_value=candidates):
        results = extract_biomarkers_llm("Glucose 95 mg/dL")

    assert results == []


def test_biomarker_empty_input():
    results = extract_biomarkers_llm("")
    assert results == []

    results_ws = extract_biomarkers_llm("   \n  ")
    assert results_ws == []


def test_biomarker_no_candidates_configured():
    with patch("app.parsers.biomarker._llm_candidates", return_value=[]):
        results = extract_biomarkers_llm("Glucose 95 mg/dL")
    assert results == []


# ── Insights LLM Fallback Tests ─────────────────────────────────────


def test_insights_primary_openai_success():
    openai_client = MagicMock()
    mistral_client = MagicMock()

    openai_client.chat.completions.create.return_value = _mock_chat_response({
        "insights": [
            {
                "title": "Normal Glucose Levels",
                "body": "Fasting blood glucose is well within the standard range.",
                "tone": "positive",
            }
        ]
    })

    candidates = [
        (openai_client, "gpt-4o-mini", "OpenAI"),
        (mistral_client, "mistral-large-latest", "Mistral"),
    ]

    biomarkers = [{"display_name": "Glucose", "value": "95", "unit": "mg/dL", "status": "NORMAL"}]

    with patch("app.parsers.insights._insight_candidates", return_value=candidates):
        results = generate_insights(biomarkers)

    assert len(results) == 1
    assert results[0]["title"] == "Normal Glucose Levels"
    assert results[0]["tone"] == "positive"
    openai_client.chat.completions.create.assert_called_once()
    mistral_client.chat.completions.create.assert_not_called()


def test_insights_fallback_to_mistral_on_openai_error():
    openai_client = MagicMock()
    mistral_client = MagicMock()

    openai_client.chat.completions.create.side_effect = RuntimeError("OpenAI 429")
    mistral_client.chat.completions.create.return_value = _mock_chat_response({
        "insights": [
            {
                "title": "Elevated HbA1c",
                "body": "HbA1c level is slightly above the recommended threshold.",
                "tone": "watch",
            }
        ]
    })

    candidates = [
        (openai_client, "gpt-4o-mini", "OpenAI"),
        (mistral_client, "mistral-large-latest", "Mistral"),
    ]

    biomarkers = [{"display_name": "HbA1c", "value": "6.2", "unit": "%", "status": "HIGH"}]

    with patch("app.parsers.insights._insight_candidates", return_value=candidates):
        results = generate_insights(biomarkers)

    assert len(results) == 1
    assert results[0]["title"] == "Elevated HbA1c"
    assert results[0]["tone"] == "watch"
    mistral_client.chat.completions.create.assert_called_once()


def test_insights_all_providers_fail():
    openai_client = MagicMock()
    mistral_client = MagicMock()

    openai_client.chat.completions.create.side_effect = RuntimeError("OpenAI down")
    mistral_client.chat.completions.create.side_effect = RuntimeError("Mistral down")

    candidates = [
        (openai_client, "gpt-4o-mini", "OpenAI"),
        (mistral_client, "mistral-large-latest", "Mistral"),
    ]

    biomarkers = [{"display_name": "Glucose", "value": "95", "unit": "mg/dL", "status": "NORMAL"}]

    with patch("app.parsers.insights._insight_candidates", return_value=candidates):
        results = generate_insights(biomarkers)

    assert results == []


def test_insights_empty_biomarkers():
    results = generate_insights([])
    assert results == []

