"""Tests for FallbackNormalizer orchestrator."""

from unittest.mock import MagicMock
import pytest

from app.normalization.circuit_breaker import CircuitBreaker
from app.normalization.errors import (
    AllProvidersFailedError,
    NormalizationError,
    ProviderUnavailableError,
)
from app.normalization.orchestrator import FallbackNormalizer


def make_provider(name: str, side_effect=None, return_value=None):
    p = MagicMock()
    p.name = name
    if side_effect:
        p.normalize.side_effect = side_effect
    else:
        p.normalize.return_value = return_value
    return p


def test_uses_primary_when_healthy():
    primary = make_provider("openai", return_value="normalized text")
    fallback = make_provider("mistral")
    orch = FallbackNormalizer(primary, fallback, max_retries=0)

    text, provider = orch.normalize("raw", doc_id="1")

    assert text == "normalized text"
    assert provider == "openai"
    fallback.normalize.assert_not_called()


def test_falls_back_on_quota_exhausted():
    primary = make_provider(
        "openai",
        side_effect=ProviderUnavailableError("quota exhausted", provider="openai", retriable=False),
    )
    fallback = make_provider("mistral", return_value="mistral normalized")
    orch = FallbackNormalizer(primary, fallback, max_retries=1)

    text, provider = orch.normalize("raw", doc_id="1")

    assert text == "mistral normalized"
    assert provider == "mistral"
    assert primary.normalize.call_count == 1  # non-retriable: skips retry loop


def test_falls_back_on_retriable_error_after_retries():
    primary = make_provider(
        "openai",
        side_effect=ProviderUnavailableError("rate limited", provider="openai", retriable=True),
    )
    fallback = make_provider("mistral", return_value="mistral normalized")
    orch = FallbackNormalizer(primary, fallback, max_retries=2, backoff_base=0.01)

    text, provider = orch.normalize("raw", doc_id="1")

    assert text == "mistral normalized"
    assert provider == "mistral"
    assert primary.normalize.call_count == 3  # initial + 2 retries


def test_raises_when_both_fail():
    primary = make_provider(
        "openai",
        side_effect=ProviderUnavailableError("down", provider="openai"),
    )
    fallback = make_provider(
        "mistral",
        side_effect=ProviderUnavailableError("also down", provider="mistral"),
    )
    orch = FallbackNormalizer(primary, fallback, max_retries=0)

    with pytest.raises(AllProvidersFailedError) as exc_info:
        orch.normalize("raw", doc_id="1")

    assert isinstance(exc_info.value.primary_error, ProviderUnavailableError)
    assert isinstance(exc_info.value.fallback_error, ProviderUnavailableError)


def test_does_not_fall_back_on_bad_request():
    primary = make_provider("openai", side_effect=NormalizationError("bad prompt"))
    fallback = make_provider("mistral")
    orch = FallbackNormalizer(primary, fallback, max_retries=0)

    with pytest.raises(NormalizationError):
        orch.normalize("raw", doc_id="1")
    fallback.normalize.assert_not_called()


def test_circuit_breaker_skips_primary_when_open():
    primary = make_provider("openai")
    fallback = make_provider("mistral", return_value="mistral normalized")
    breaker = CircuitBreaker(failure_threshold=1, cooldown_seconds=999)
    breaker.record_failure()  # force OPEN
    assert breaker.state == "OPEN"

    orch = FallbackNormalizer(primary, fallback, max_retries=0, circuit_breaker=breaker)

    text, provider = orch.normalize("raw", doc_id="1")

    assert text == "mistral normalized"
    assert provider == "mistral"
    primary.normalize.assert_not_called()


def test_single_provider_primary_only():
    primary = make_provider("openai", return_value="primary only")
    orch = FallbackNormalizer(primary=primary, fallback=None)

    text, provider = orch.normalize("raw", doc_id="1")
    assert text == "primary only"
    assert provider == "openai"


def test_single_provider_primary_failure_raises_all_failed():
    primary = make_provider(
        "openai",
        side_effect=ProviderUnavailableError("down", provider="openai"),
    )
    orch = FallbackNormalizer(primary=primary, fallback=None, max_retries=0)

    with pytest.raises(AllProvidersFailedError):
        orch.normalize("raw", doc_id="1")


def test_process_candidate_normalizes_text_when_available():
    from unittest.mock import patch
    from app.extractors import _process_candidate

    mock_normalizer = MagicMock()
    mock_normalizer.normalize.return_value = ("Cleaned normalized text", "openai")

    candidate_input = {
        "text": "Raw patient report with broken- text",
        "pages": [{"page": 1, "text": "Raw patient report with broken- text"}],
    }

    with patch("app.normalization.get_text_normalizer", return_value=mock_normalizer), \
         patch("app.parsers.extract_biomarkers_llm", return_value=[]):
        processed = _process_candidate(candidate_input, "mistral_ocr")

    assert processed["metadata"]["text_normalization"]["status"] == "ok"
    assert processed["metadata"]["text_normalization"]["provider"] == "openai"
    assert processed["masked_text"] == "Cleaned normalized text"


def test_process_candidate_graceful_on_normalization_failure():
    from unittest.mock import patch
    from app.extractors import _process_candidate

    mock_normalizer = MagicMock()
    mock_normalizer.normalize.side_effect = AllProvidersFailedError("Both failed")

    candidate_input = {
        "text": "Raw patient report",
        "pages": [{"page": 1, "text": "Raw patient report"}],
    }

    with patch("app.normalization.get_text_normalizer", return_value=mock_normalizer), \
         patch("app.parsers.extract_biomarkers_llm", return_value=[]):
        processed = _process_candidate(candidate_input, "mistral_ocr")

    assert processed["metadata"]["text_normalization"]["status"] == "failed"
    assert processed["metadata"]["text_normalization"]["provider"] is None
    # Text proceeds un-normalized
    assert "Raw patient report" in processed["masked_text"]

