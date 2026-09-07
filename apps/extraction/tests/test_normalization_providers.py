"""Tests for normalization providers (OpenAI & Mistral)."""

from unittest.mock import MagicMock
import httpx
import openai
import pytest

from app.normalization.errors import NormalizationError, ProviderUnavailableError
from app.normalization.providers import MistralNormalizer, OpenAINormalizer


def _make_mock_response(content: str):
    choice = MagicMock()
    choice.message.content = content
    resp = MagicMock()
    resp.choices = [choice]
    return resp


def _make_api_status_error(status_code: int, message: str = "error"):
    req = httpx.Request("POST", "http://test")
    resp = httpx.Response(status_code, request=req)
    return openai.APIStatusError(message, response=resp, body={"message": message})


# ── OpenAINormalizer Tests ──────────────────────────────────────────


def test_openai_success():
    client = MagicMock()
    client.chat.completions.create.return_value = _make_mock_response("Normalized text")
    normalizer = OpenAINormalizer(client=client)

    result = normalizer.normalize("raw text", doc_id="doc1")
    assert result == "Normalized text"
    client.chat.completions.create.assert_called_once()


def test_openai_empty_input():
    client = MagicMock()
    normalizer = OpenAINormalizer(client=client)
    assert normalizer.normalize("") == ""
    assert normalizer.normalize("   ") == ""
    client.chat.completions.create.assert_not_called()


def test_openai_empty_response():
    client = MagicMock()
    client.chat.completions.create.return_value = _make_mock_response("")
    normalizer = OpenAINormalizer(client=client)

    with pytest.raises(NormalizationError, match="empty normalization output"):
        normalizer.normalize("raw text")


def test_openai_insufficient_quota_non_retriable():
    client = MagicMock()
    req = httpx.Request("POST", "http://test")
    resp = httpx.Response(429, request=req)
    err = openai.RateLimitError(
        "quota exhausted",
        response=resp,
        body={"error": {"code": "insufficient_quota", "message": "quota exceeded"}},
    )
    client.chat.completions.create.side_effect = err
    normalizer = OpenAINormalizer(client=client)

    with pytest.raises(ProviderUnavailableError) as exc_info:
        normalizer.normalize("raw text")
    assert exc_info.value.retriable is False
    assert exc_info.value.provider == "openai"


def test_openai_rate_limit_retriable():
    client = MagicMock()
    req = httpx.Request("POST", "http://test")
    resp = httpx.Response(429, request=req)
    err = openai.RateLimitError(
        "rate limit exceeded",
        response=resp,
        body={"error": {"code": "rate_limit_exceeded"}},
    )
    client.chat.completions.create.side_effect = err
    normalizer = OpenAINormalizer(client=client)

    with pytest.raises(ProviderUnavailableError) as exc_info:
        normalizer.normalize("raw text")
    assert exc_info.value.retriable is True
    assert exc_info.value.provider == "openai"


def test_openai_auth_error_non_retriable():
    client = MagicMock()
    req = httpx.Request("POST", "http://test")
    resp = httpx.Response(401, request=req)
    err = openai.AuthenticationError("Invalid API key", response=resp, body=None)
    client.chat.completions.create.side_effect = err
    normalizer = OpenAINormalizer(client=client)

    with pytest.raises(ProviderUnavailableError) as exc_info:
        normalizer.normalize("raw text")
    assert exc_info.value.retriable is False
    assert exc_info.value.provider == "openai"


def test_openai_connection_error_retriable():
    client = MagicMock()
    req = httpx.Request("POST", "http://test")
    err = openai.APIConnectionError(request=req)
    client.chat.completions.create.side_effect = err
    normalizer = OpenAINormalizer(client=client)

    with pytest.raises(ProviderUnavailableError) as exc_info:
        normalizer.normalize("raw text")
    assert exc_info.value.retriable is True


def test_openai_timeout_error_retriable():
    client = MagicMock()
    req = httpx.Request("POST", "http://test")
    err = openai.APITimeoutError(request=req)
    client.chat.completions.create.side_effect = err
    normalizer = OpenAINormalizer(client=client)

    with pytest.raises(ProviderUnavailableError) as exc_info:
        normalizer.normalize("raw text")
    assert exc_info.value.retriable is True


def test_openai_server_error_500_retriable():
    client = MagicMock()
    client.chat.completions.create.side_effect = _make_api_status_error(500, "Internal Server Error")
    normalizer = OpenAINormalizer(client=client)

    with pytest.raises(ProviderUnavailableError) as exc_info:
        normalizer.normalize("raw text")
    assert exc_info.value.retriable is True


def test_openai_bad_request_400_normalization_error():
    client = MagicMock()
    client.chat.completions.create.side_effect = _make_api_status_error(400, "Bad Request")
    normalizer = OpenAINormalizer(client=client)

    with pytest.raises(NormalizationError):
        normalizer.normalize("raw text")


def test_openai_truncation():
    client = MagicMock()
    client.chat.completions.create.return_value = _make_mock_response("Truncated ok")
    normalizer = OpenAINormalizer(client=client)

    long_text = "a" * 25_000
    normalizer.normalize(long_text)
    call_args = client.chat.completions.create.call_args
    prompt_sent = call_args.kwargs["messages"][0]["content"]
    # Should not contain 25000 'a's
    assert "a" * 20_000 not in prompt_sent


# ── MistralNormalizer Tests ─────────────────────────────────────────


def test_mistral_success():
    client = MagicMock()
    client.chat.completions.create.return_value = _make_mock_response("Mistral normalized")
    normalizer = MistralNormalizer(client=client)

    result = normalizer.normalize("raw text", doc_id="doc2")
    assert result == "Mistral normalized"
    assert normalizer.name == "mistral"


def test_mistral_empty_input():
    client = MagicMock()
    normalizer = MistralNormalizer(client=client)
    assert normalizer.normalize("") == ""
    client.chat.completions.create.assert_not_called()


def test_mistral_empty_response():
    client = MagicMock()
    client.chat.completions.create.return_value = _make_mock_response("   ")
    normalizer = MistralNormalizer(client=client)

    with pytest.raises(NormalizationError, match="empty normalization output"):
        normalizer.normalize("raw text")


def test_mistral_auth_401_non_retriable():
    client = MagicMock()
    client.chat.completions.create.side_effect = _make_api_status_error(401, "Unauthorized")
    normalizer = MistralNormalizer(client=client)

    with pytest.raises(ProviderUnavailableError) as exc_info:
        normalizer.normalize("raw text")
    assert exc_info.value.retriable is False
    assert exc_info.value.provider == "mistral"


def test_mistral_forbidden_403_non_retriable():
    client = MagicMock()
    client.chat.completions.create.side_effect = _make_api_status_error(403, "Forbidden")
    normalizer = MistralNormalizer(client=client)

    with pytest.raises(ProviderUnavailableError) as exc_info:
        normalizer.normalize("raw text")
    assert exc_info.value.retriable is False
    assert exc_info.value.provider == "mistral"


def test_mistral_rate_limited_429_retriable():
    client = MagicMock()
    client.chat.completions.create.side_effect = _make_api_status_error(429, "Rate limit reached")
    normalizer = MistralNormalizer(client=client)

    with pytest.raises(ProviderUnavailableError) as exc_info:
        normalizer.normalize("raw text")
    assert exc_info.value.retriable is True
    assert exc_info.value.provider == "mistral"


def test_mistral_server_503_retriable():
    client = MagicMock()
    client.chat.completions.create.side_effect = _make_api_status_error(503, "Service Unavailable")
    normalizer = MistralNormalizer(client=client)

    with pytest.raises(ProviderUnavailableError) as exc_info:
        normalizer.normalize("raw text")
    assert exc_info.value.retriable is True
    assert exc_info.value.provider == "mistral"

