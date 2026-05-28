"""
PHI tokenization.

Replaces detected entities with deterministic tokens of the form
[ENTITY_TYPE_<8hex>]. Identical (entity_type, text) pairs map to the
same token within a single TokenVault, so cross-page values stay consistent.
"""

import hashlib
import logging

logger = logging.getLogger(__name__)


def _generate_token(entity_type: str, text: str) -> str:
    digest = hashlib.sha256(f"{entity_type}:{text}".encode()).hexdigest()[:8]
    return f"[{entity_type}_{digest}]"


class TokenVault:
    """In-memory bidirectional mapping between tokens and original PHI values."""

    def __init__(self) -> None:
        self._token_to_original: dict[str, str] = {}
        self._original_to_token: dict[str, str] = {}

    def tokenize(self, entity_type: str, original_text: str) -> str:
        key = f"{entity_type}:{original_text}"
        if key in self._original_to_token:
            return self._original_to_token[key]

        token = _generate_token(entity_type, original_text)
        self._token_to_original[token] = original_text
        self._original_to_token[key] = token
        return token

    def detokenize(self, token: str) -> str | None:
        return self._token_to_original.get(token)

    def to_dict(self) -> dict[str, str]:
        return dict(self._token_to_original)

    @property
    def size(self) -> int:
        return len(self._token_to_original)


def mask_text(
    text: str, vault: "TokenVault | None" = None
) -> tuple[str, TokenVault, list[dict]]:
    """Detect PHI in `text`, replace each occurrence with a vault token."""
    from . import detect_phi  # local import to avoid circular at module load

    if vault is None:
        vault = TokenVault()

    entities = detect_phi(text)
    if not entities:
        return text, vault, []

    masked = text
    entity_dicts: list[dict] = []

    for entity in reversed(entities):
        token = vault.tokenize(entity.entity_type, entity.text)
        masked = masked[: entity.start] + token + masked[entity.end :]
        entity_dicts.append({**entity.to_dict(), "token": token})

    entity_dicts.reverse()
    logger.info("Masked %d PHI entities (%d unique tokens)", len(entities), vault.size)
    return masked, vault, entity_dicts


def mask_pages(pages: list[dict]) -> tuple[list[dict], TokenVault, list[dict]]:
    """Mask PHI across pages with a shared vault for token consistency."""
    vault = TokenVault()
    masked_pages: list[dict] = []
    all_entities: list[dict] = []

    for page in pages:
        page_num = page.get("page", 0)
        text = page.get("text", "")
        masked, vault, entities = mask_text(text, vault)
        masked_pages.append({"page": page_num, "text": masked})
        for e in entities:
            e["page"] = page_num
            all_entities.append(e)

    logger.info(
        "Masked %d pages — %d total entities, %d unique tokens",
        len(pages),
        len(all_entities),
        vault.size,
    )
    return masked_pages, vault, all_entities
