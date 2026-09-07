"""Error taxonomy for OCR text normalization."""


class NormalizationError(Exception):
    """Base class for normalization errors that should NOT trigger fallback.

    e.g. bad request, invalid schema, content policy rejection.
    These indicate a bug or bad input, not a provider outage — retrying
    with a different provider usually won't help and may mask a bug.
    """
    pass


class ProviderUnavailableError(Exception):
    """Raised when a provider fails in a way that SHOULD trigger fallback.

    e.g. quota exhausted, rate limited, auth failure, timeout, 5xx.
    """

    def __init__(self, message: str, provider: str, retriable: bool = True):
        super().__init__(message)
        self.provider = provider
        self.retriable = retriable


class AllProvidersFailedError(Exception):
    """Raised when both primary and fallback providers failed.

    Caller must handle this explicitly — queue for retry, alert, or degrade.
    Never swallow this and return raw/garbage text downstream silently.
    """

    def __init__(
        self,
        message: str,
        primary_error: Exception | None = None,
        fallback_error: Exception | None = None,
    ):
        super().__init__(message)
        self.primary_error = primary_error
        self.fallback_error = fallback_error

