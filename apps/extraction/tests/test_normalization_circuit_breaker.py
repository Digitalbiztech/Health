"""Tests for CircuitBreaker."""

import time
from app.normalization.circuit_breaker import CircuitBreaker


def test_initial_state_closed():
    breaker = CircuitBreaker(failure_threshold=3, cooldown_seconds=10.0)
    assert breaker.state == "CLOSED"
    assert breaker.allow_request() is True


def test_failures_below_threshold_stay_closed():
    breaker = CircuitBreaker(failure_threshold=3, cooldown_seconds=10.0)
    breaker.record_failure()
    assert breaker.state == "CLOSED"
    assert breaker.allow_request() is True

    breaker.record_failure()
    assert breaker.state == "CLOSED"
    assert breaker.allow_request() is True


def test_reaches_threshold_opens():
    breaker = CircuitBreaker(failure_threshold=3, cooldown_seconds=10.0)
    breaker.record_failure()
    breaker.record_failure()
    breaker.record_failure()
    assert breaker.state == "OPEN"
    assert breaker.allow_request() is False


def test_cooldown_transitions_to_half_open():
    breaker = CircuitBreaker(failure_threshold=2, cooldown_seconds=0.05)
    breaker.record_failure()
    breaker.record_failure()
    assert breaker.state == "OPEN"
    assert breaker.allow_request() is False

    time.sleep(0.06)
    # After cooldown, allow_request should transition to HALF_OPEN and return True
    assert breaker.allow_request() is True
    assert breaker.state == "HALF_OPEN"


def test_half_open_success_resets_to_closed():
    breaker = CircuitBreaker(failure_threshold=2, cooldown_seconds=0.05)
    breaker.record_failure()
    breaker.record_failure()
    time.sleep(0.06)
    assert breaker.allow_request() is True
    assert breaker.state == "HALF_OPEN"

    breaker.record_success()
    assert breaker.state == "CLOSED"
    assert breaker.allow_request() is True


def test_half_open_failure_reopens_immediately():
    breaker = CircuitBreaker(failure_threshold=2, cooldown_seconds=0.05)
    breaker.record_failure()
    breaker.record_failure()
    time.sleep(0.06)
    assert breaker.allow_request() is True
    assert breaker.state == "HALF_OPEN"

    breaker.record_failure()
    assert breaker.state == "OPEN"
    assert breaker.allow_request() is False

