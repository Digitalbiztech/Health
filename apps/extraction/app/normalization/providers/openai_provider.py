"""OpenAI normalization provider."""

import logging
import openai

from app.normalization.errors import NormalizationError
from app.normalization.providers.base import (
    NORMALIZATION_PROMPT,
    TextNormalizer,
    map_openai_api_error,
)

logger = logging.getLogger("normalization.openai")

MAX_INPUT_CHARS = 18_000


class OpenAINormalizer(TextNormalizer):
    name = "openai"

    def __init__(
        self,
        client: openai.OpenAI,
        model: str = "gpt-4o-mini",
        timeout: float = 30.0,
    ):
        self.client = client
        self.model = model
        self.timeout = timeout

    def normalize(self, raw_text: str, *, doc_id: str | None = None) -> str:
        if not raw_text or not raw_text.strip():
            return ""

        payload = raw_text[:MAX_INPUT_CHARS]
        if len(raw_text) > MAX_INPUT_CHARS:
            logger.info(
                "[doc=%s] Truncating normalization text from %d -> %d chars",
                doc_id,
                len(raw_text),
                MAX_INPUT_CHARS,
            )

        try:
            resp = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "user", "content": NORMALIZATION_PROMPT.format(raw_text=payload)}
                ],
                timeout=self.timeout,
                temperature=0,
            )
            content = resp.choices[0].message.content
            if not content or not content.strip():
                raise NormalizationError("OpenAI returned empty normalization output")
            return content.strip()

        except Exception as e:
            map_openai_api_error(e, self.name, doc_id=doc_id)
            raise  # In case map_openai_api_error didn't raise

