"""Configuration for OCR text normalization."""

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass
class NormalizationConfig:
    openai_api_key: str | None = None
    mistral_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    mistral_model: str = "mistral-large-latest"
    max_retries: int = 1
    request_timeout: float = 30.0
    circuit_breaker_failure_threshold: int = 5
    circuit_breaker_cooldown_seconds: float = 60.0

    @classmethod
    def from_env(cls) -> "NormalizationConfig":
        openai_key = os.getenv("OPENAI_API_KEY", "").strip() or None
        mistral_key = os.getenv("MISTRAL_API_KEY", "").strip() or None

        return cls(
            openai_api_key=openai_key,
            mistral_api_key=mistral_key,
            openai_model=os.getenv("OPENAI_NORMALIZATION_MODEL")
            or os.getenv("OPENAI_MODEL")
            or "gpt-4o-mini",
            mistral_model=os.getenv("MISTRAL_NORMALIZATION_MODEL")
            or os.getenv("MISTRAL_MODEL")
            or "mistral-large-latest",
            max_retries=int(os.getenv("NORMALIZATION_MAX_RETRIES", "1")),
            request_timeout=float(os.getenv("NORMALIZATION_TIMEOUT", "30.0")),
            circuit_breaker_failure_threshold=int(
                os.getenv("CB_FAILURE_THRESHOLD", "5")
            ),
            circuit_breaker_cooldown_seconds=float(
                os.getenv("CB_COOLDOWN_SECONDS", "60.0")
            ),
        )

