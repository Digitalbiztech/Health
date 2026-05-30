"""
Fuzzy matching utilities for biomarker name resolution.

Pure-Python implementations — no external C-extension dependencies.
Provides Levenshtein distance, token-set similarity, and a combined
best-match orchestrator used by the normalizer's fallback strategies.
"""

from __future__ import annotations

import re


def levenshtein_distance(a: str, b: str) -> int:
    """Compute the Levenshtein (edit) distance between two strings.

    Uses an optimised single-row DP approach — O(min(m,n)) space.
    """
    if len(a) < len(b):
        return levenshtein_distance(b, a)

    if not b:
        return len(a)

    prev_row = list(range(len(b) + 1))
    for i, ca in enumerate(a):
        curr_row = [i + 1]
        for j, cb in enumerate(b):
            cost = 0 if ca == cb else 1
            curr_row.append(
                min(
                    curr_row[j] + 1,       # insertion
                    prev_row[j + 1] + 1,   # deletion
                    prev_row[j] + cost,     # substitution
                )
            )
        prev_row = curr_row

    return prev_row[-1]


def levenshtein_ratio(a: str, b: str) -> float:
    """Normalised Levenshtein similarity in [0.0, 1.0].

    1.0 means identical; 0.0 means completely different.
    """
    max_len = max(len(a), len(b))
    if max_len == 0:
        return 1.0
    return 1.0 - (levenshtein_distance(a, b) / max_len)


def _tokenize(text: str) -> list[str]:
    """Split on non-alphanumeric boundaries, lowercase, deduplicate, sort."""
    tokens = re.findall(r"[a-z0-9]+", text.lower())
    return sorted(set(tokens))


def token_set_score(query: str, candidate: str) -> float:
    """Jaccard-style token-set overlap score in [0.0, 1.0].

    Measures what fraction of the combined unique tokens are shared.
    Handles word-order differences and extra qualifiers gracefully:
        "fasting blood glucose" vs "glucose fasting" → high score
    """
    q_tokens = set(_tokenize(query))
    c_tokens = set(_tokenize(candidate))

    if not q_tokens or not c_tokens:
        return 0.0

    intersection = q_tokens & c_tokens
    union = q_tokens | c_tokens
    return len(intersection) / len(union)


def best_fuzzy_match(
    query: str,
    candidates: dict[str, list[str]],
    threshold: float = 0.75,
) -> tuple[str, float] | None:
    """Find the best fuzzy match for *query* against a candidate map.

    Parameters
    ----------
    query : str
        The raw biomarker name to resolve (already lowercased/cleaned).
    candidates : dict[str, list[str]]
        Mapping of ``canonical_name`` → list of known aliases.
    threshold : float
        Minimum Levenshtein ratio to consider a match valid.

    Returns
    -------
    tuple[str, float] | None
        ``(canonical_name, score)`` for the best match above threshold,
        or ``None`` if nothing qualifies.
    """
    best_canonical: str | None = None
    best_score: float = 0.0

    for canonical, aliases in candidates.items():
        # Check the canonical key itself
        score = levenshtein_ratio(query, canonical)
        if score > best_score:
            best_score = score
            best_canonical = canonical

        # Check each alias
        for alias in aliases:
            score = levenshtein_ratio(query, alias.lower())
            if score > best_score:
                best_score = score
                best_canonical = canonical

    if best_canonical and best_score >= threshold:
        return best_canonical, best_score

    return None


def best_token_set_match(
    query: str,
    candidates: dict[str, list[str]],
    threshold: float = 0.65,
) -> tuple[str, float] | None:
    """Find the best token-set-similarity match.

    Parameters
    ----------
    query : str
        The raw biomarker name to resolve.
    candidates : dict[str, list[str]]
        Mapping of ``canonical_name`` → list of known aliases.
    threshold : float
        Minimum token-set overlap score.

    Returns
    -------
    tuple[str, float] | None
        ``(canonical_name, score)`` or ``None``.
    """
    best_canonical: str | None = None
    best_score: float = 0.0

    for canonical, aliases in candidates.items():
        score = token_set_score(query, canonical)
        if score > best_score:
            best_score = score
            best_canonical = canonical

        for alias in aliases:
            score = token_set_score(query, alias)
            if score > best_score:
                best_score = score
                best_canonical = canonical

    if best_canonical and best_score >= threshold:
        return best_canonical, best_score

    return None
