"""Common interface and utilities for normalization providers."""

import logging
from abc import ABC, abstractmethod

import openai

from app.normalization.errors import NormalizationError, ProviderUnavailableError

logger = logging.getLogger("normalization.providers")

NORMALIZATION_PROMPT = """You are a text normalization engine for OCR output.
Fix broken line breaks, hyphenation artifacts, spacing errors, and obvious
OCR misreads. Preserve all factual content, numbers, and structure
(headings, lists, tables) exactly. Do not summarize or omit anything.
CRITICAL: Preserve all PHI-masking placeholders (such as [NAME_1], [DATE_1], [PHONE_1], [LOCATION_1], etc.) exactly as written.
Return ONLY the normalized text, no commentary.

Raw OCR text:
---
{raw_text}
---
"""


def _extract_code(e: Exception) -> str | None:
    try:
        body = getattr(e, "body", None)
        if isinstance(body, dict):
            return body.get("error", {}).get("code")
    except Exception:
        pass
    return None


def map_openai_api_error(
    e: Exception,
    provider: str,
    doc_id: str | None = None,
) -> None:
    """Translate OpenAI SDK exceptions into NormalizationError or ProviderUnavailableError.

    Always raises.
    """
    prefix = f"[doc={doc_id}] " if doc_id else ""

    if isinstance(e, openai.RateLimitError):
        code = getattr(e, "code", None) or _extract_code(e)
        is_quota = code == "insufficient_quota"
        logger.warning("%s%s rate/quota error (code=%s): %s", prefix, provider, code, e)
        raise ProviderUnavailableError(
            f"{provider} rate/quota issue: {e}",
            provider=provider,
            retriable=not is_quota,
        ) from e

    if isinstance(e, openai.AuthenticationError):
        logger.error("%s%s auth failed: %s", prefix, provider, e)
        raise ProviderUnavailableError(
            f"{provider} auth failed: {e}",
            provider=provider,
            retriable=False,
        ) from e

    if isinstance(e, (openai.APIConnectionError, openai.APITimeoutError)):
        logger.warning("%s%s unreachable/timeout: %s", prefix, provider, e)
        raise ProviderUnavailableError(
            f"{provider} unreachable: {e}",
            provider=provider,
            retriable=True,
        ) from e

    if isinstance(e, openai.APIStatusError):
        status = e.status_code
        if status in (401, 403):
            logger.error("%s%s auth/forbidden error %d: %s", prefix, provider, status, e)
            raise ProviderUnavailableError(
                f"{provider} auth/forbidden error {status}: {e}",
                provider=provider,
                retriable=False,
            ) from e
        if status == 429:
            logger.warning("%s%s rate limited %d: %s", prefix, provider, status, e)
            raise ProviderUnavailableError(
                f"{provider} rate limited: {e}",
                provider=provider,
                retriable=True,
            ) from e
        if status >= 500:
            logger.warning("%s%s server error %d: %s", prefix, provider, status, e)
            raise ProviderUnavailableError(
                f"{provider} server error {status}: {e}",
                provider=provider,
                retriable=True,
            ) from e

        # Other 4xx errors (e.g. 400 Bad Request) indicate non-retriable bad input
        logger.error("%s%s request error %d: %s", prefix, provider, status, e)
        raise NormalizationError(f"{provider} request error: {e}") from e

    if isinstance(e, (NormalizationError, ProviderUnavailableError)):
        raise e

    logger.error("%s%s unexpected error: %s", prefix, provider, e)
    raise NormalizationError(f"{provider} unexpected error: {e}") from e


class TextNormalizer(ABC):
    """Common interface all normalization providers must implement."""

    name: str = "base"

    @abstractmethod
    def normalize(self, raw_text: str, *, doc_id: str | None = None) -> str:
        """Normalize raw OCR text.

        Must raise ProviderUnavailableError for transient/availability failures,
        or NormalizationError for non-retriable failures (bad input, content policy, etc).
        """
        raise NotImplementedError

