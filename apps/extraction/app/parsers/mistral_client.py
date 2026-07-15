"""
Mistral client singleton using OpenAI compatibility mode.

Loads MISTRAL_API_KEY / MISTRAL_MODEL from the environment via dotenv.
MISTRAL_AVAILABLE is False when the key is missing — callers must degrade
gracefully (return [] rather than raise).
"""

import logging
import os

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

MISTRAL_MODEL = os.getenv("MISTRAL_MODEL", "mistral-large-latest")
_API_KEY = os.getenv("MISTRAL_API_KEY", "").strip()
MISTRAL_AVAILABLE = bool(_API_KEY)

_client = None


def get_mistral_client():
    """Lazy singleton for the Mistral client. Returns None when unconfigured."""
    global _client
    if not MISTRAL_AVAILABLE:
        return None
    if _client is None:
        try:
            from openai import OpenAI

            # Mistral AI provides an OpenAI-compatible endpoint.
            _client = OpenAI(
                api_key=_API_KEY,
                base_url="https://api.mistral.ai/v1"
            )
            logger.info("Mistral client initialized — model=%s", MISTRAL_MODEL)
        except ImportError:
            logger.error("openai package not installed — AI features disabled")
            return None
        except Exception as e:
            logger.error("Failed to initialize Mistral client: %s", e)
            return None
    return _client
