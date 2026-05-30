"""
OpenAI client singleton.

Loads OPENAI_API_KEY / OPENAI_MODEL from the environment via dotenv.
OPENAI_AVAILABLE is False when the key is missing — callers must degrade
gracefully (return [] rather than raise).
"""

import logging
import os

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_AVAILABLE = bool(_API_KEY)

_client = None


def get_openai_client():
    """Lazy singleton for the OpenAI client. Returns None when unconfigured."""
    global _client
    if not OPENAI_AVAILABLE:
        return None
    if _client is None:
        try:
            from openai import OpenAI

            _client = OpenAI(api_key=_API_KEY)
            logger.info("OpenAI client initialized — model=%s", OPENAI_MODEL)
        except ImportError:
            logger.error("openai package not installed — AI features disabled")
            return None
        except Exception as e:
            logger.error("Failed to initialize OpenAI client: %s", e)
            return None
    return _client
