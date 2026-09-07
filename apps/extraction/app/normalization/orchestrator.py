"""Orchestrator for normalization with fallback and retry logic."""

import logging
import time

from app.normalization.circuit_breaker import CircuitBreaker
from app.normalization.errors import (
    AllProvidersFailedError,
    NormalizationError,
    ProviderUnavailableError,
)
from app.normalization.providers.base import TextNormalizer

logger = logging.getLogger("normalization.orchestrator")


class FallbackNormalizer:
    def __init__(
        self,
        primary: TextNormalizer | None,
        fallback: TextNormalizer | None = None,
        max_retries: int = 1,
        backoff_base: float = 1.5,
        circuit_breaker: CircuitBreaker | None = None,
    ):
        self.primary = primary
        self.fallback = fallback
        self.max_retries = max_retries
        self.backoff_base = backoff_base
        self.circuit_breaker = circuit_breaker or CircuitBreaker()

    def normalize(self, raw_text: str, *, doc_id: str | None = None) -> tuple[str, str]:
        """Normalize raw text using primary provider with automatic fallback.

        Returns (normalized_text, provider_used).
        Raises AllProvidersFailedError if all attempted providers fail.
        Raises NormalizationError immediately if an unrecoverable bad-input error occurs.
        """
        primary_error: Exception | None = None

        if self.primary is not None:
            if self.circuit_breaker.allow_request():
                for attempt in range(self.max_retries + 1):
                    try:
                        result = self.primary.normalize(raw_text, doc_id=doc_id)
                        self.circuit_breaker.record_success()
                        return result, self.primary.name
                    except ProviderUnavailableError as e:
                        primary_error = e
                        self.circuit_breaker.record_failure()
                        logger.warning(
                            "[doc=%s] Primary '%s' failed (attempt %d/%d): %s",
                            doc_id,
                            self.primary.name,
                            attempt + 1,
                            self.max_retries + 1,
                            e,
                        )
                        if not e.retriable or attempt >= self.max_retries:
                            break
                        time.sleep(self.backoff_base**attempt)
                    except NormalizationError as e:
                        # Non-retriable, non-availability error: do NOT fall back.
                        # This indicates a bug or malformed input — surface it directly.
                        logger.error(
                            "[doc=%s] Primary '%s' bad-input error: %s",
                            doc_id,
                            self.primary.name,
                            e,
                        )
                        raise
            else:
                logger.info(
                    "[doc=%s] Circuit breaker OPEN for '%s', skipping straight to fallback",
                    doc_id,
                    self.primary.name,
                )
                primary_error = ProviderUnavailableError(
                    "circuit breaker open",
                    provider=self.primary.name,
                    retriable=False,
                )

        if self.fallback is not None:
            fallback_name = self.fallback.name
            logger.info("[doc=%s] Using fallback '%s'", doc_id, fallback_name)
            try:
                result = self.fallback.normalize(raw_text, doc_id=doc_id)
                return result, fallback_name
            except (ProviderUnavailableError, NormalizationError) as fallback_error:
                logger.error(
                    "[doc=%s] Fallback '%s' also failed: %s",
                    doc_id,
                    fallback_name,
                    fallback_error,
                )
                raise AllProvidersFailedError(
                    f"Both providers failed for doc={doc_id}",
                    primary_error=primary_error,
                    fallback_error=fallback_error,
                ) from fallback_error
            except Exception as fallback_error:
                logger.error(
                    "[doc=%s] Fallback '%s' encountered unexpected error: %s",
                    doc_id,
                    fallback_name,
                    fallback_error,
                )
                raise AllProvidersFailedError(
                    f"Fallback unexpected failure for doc={doc_id}",
                    primary_error=primary_error,
                    fallback_error=fallback_error,
                ) from fallback_error

        raise AllProvidersFailedError(
            f"No working normalization provider for doc={doc_id}",
            primary_error=primary_error,
            fallback_error=None,
        )

