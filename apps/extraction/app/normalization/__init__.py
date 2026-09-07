"""OCR text normalization with OpenAI primary and Mistral fallback."""

import logging
import openai

from app.normalization.circuit_breaker import CircuitBreaker
from app.normalization.config import NormalizationConfig
from app.normalization.errors import (
    AllProvidersFailedError,
    NormalizationError,
    ProviderUnavailableError,
)
from app.normalization.orchestrator import FallbackNormalizer
from app.normalization.providers.mistral_provider import MistralNormalizer
from app.normalization.providers.openai_provider import OpenAINormalizer

logger = logging.getLogger("normalization")

_normalizer_singleton: FallbackNormalizer | None = None
_initialized: bool = False


def build_text_normalizer(
    cfg: NormalizationConfig | None = None,
) -> FallbackNormalizer | None:
    """Construct a FallbackNormalizer instance from configuration.

    Returns None if no provider API keys are configured (feature disabled).
    """
    config = cfg or NormalizationConfig.from_env()

    primary = None
    if config.openai_api_key:
        try:
            openai_client = openai.OpenAI(api_key=config.openai_api_key)
            primary = OpenAINormalizer(
                openai_client,
                model=config.openai_model,
                timeout=config.request_timeout,
            )
        except Exception as e:
            logger.warning("Failed to initialize OpenAI text normalizer: %s", e)

    fallback = None
    if config.mistral_api_key:
        try:
            mistral_client = openai.OpenAI(
                api_key=config.mistral_api_key,
                base_url="https://api.mistral.ai/v1",
            )
            fallback = MistralNormalizer(
                mistral_client,
                model=config.mistral_model,
                timeout=config.request_timeout,
            )
        except Exception as e:
            logger.warning("Failed to initialize Mistral text normalizer: %s", e)

    if primary is None and fallback is None:
        logger.info("Neither OpenAI nor Mistral configured for text normalization — disabled")
        return None

    breaker = CircuitBreaker(
        failure_threshold=config.circuit_breaker_failure_threshold,
        cooldown_seconds=config.circuit_breaker_cooldown_seconds,
    )

    return FallbackNormalizer(
        primary=primary,
        fallback=fallback,
        max_retries=config.max_retries,
        circuit_breaker=breaker,
    )


def get_text_normalizer() -> FallbackNormalizer | None:
    """Retrieve the process-wide FallbackNormalizer singleton.

    Maintains circuit breaker state across requests.
    """
    global _normalizer_singleton, _initialized
    if not _initialized:
        _normalizer_singleton = build_text_normalizer()
        _initialized = True
    return _normalizer_singleton


__all__ = [
    "AllProvidersFailedError",
    "CircuitBreaker",
    "FallbackNormalizer",
    "NormalizationConfig",
    "NormalizationError",
    "ProviderUnavailableError",
    "build_text_normalizer",
    "get_text_normalizer",
]

