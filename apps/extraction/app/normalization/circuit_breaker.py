"""Circuit breaker for normalization providers."""

import logging
import threading
import time

logger = logging.getLogger("normalization.circuit_breaker")


class CircuitBreaker:
    """Simple 3-state circuit breaker: CLOSED -> OPEN -> HALF_OPEN -> CLOSED.

    Thread-safe for use in multi-threaded/async worker pools.
    """

    def __init__(self, failure_threshold: int = 5, cooldown_seconds: float = 60.0):
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self._failure_count = 0
        self._state = "CLOSED"
        self._opened_at: float | None = None
        self._lock = threading.Lock()

    def allow_request(self) -> bool:
        with self._lock:
            if self._state == "OPEN":
                if self._opened_at is not None and (time.time() - self._opened_at >= self.cooldown_seconds):
                    self._state = "HALF_OPEN"
                    logger.info("Circuit breaker: OPEN -> HALF_OPEN, allowing trial request")
                    return True
                return False
            return True  # CLOSED or HALF_OPEN allows requests

    def record_success(self):
        with self._lock:
            if self._state != "CLOSED":
                logger.info("Circuit breaker: %s -> CLOSED after success", self._state)
            self._state = "CLOSED"
            self._failure_count = 0
            self._opened_at = None

    def record_failure(self):
        with self._lock:
            self._failure_count += 1
            if self._state == "HALF_OPEN":
                # trial request failed, reopen immediately
                self._state = "OPEN"
                self._opened_at = time.time()
                logger.warning("Circuit breaker: HALF_OPEN trial failed -> OPEN")
            elif self._failure_count >= self.failure_threshold:
                self._state = "OPEN"
                self._opened_at = time.time()
                logger.warning(
                    "Circuit breaker: CLOSED -> OPEN after %d failures",
                    self._failure_count,
                )

    @property
    def state(self) -> str:
        with self._lock:
            return self._state

