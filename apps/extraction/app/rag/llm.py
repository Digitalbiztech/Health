# apps/extraction/app/rag/llm.py
import logging
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from app.rag.config import (
    OPENAI_API_KEY,
    LLM_MODEL,
    EMBEDDING_MODEL,
    SUPABASE_DB_URL,
    MISTRAL_API_KEY,
    MISTRAL_MODEL,
)

logger = logging.getLogger(__name__)

_chat_model = None
_embeddings = None
_pool: ConnectionPool | None = None

def get_chat_model() -> ChatOpenAI:
    """Lazy singleton for ChatOpenAI model."""
    global _chat_model
    if _chat_model is None:
        if MISTRAL_API_KEY and not OPENAI_API_KEY:
            logger.info("Initializing RAG ChatModel with Mistral AI — model=%s", MISTRAL_MODEL)
            _chat_model = ChatOpenAI(
                model=MISTRAL_MODEL,
                api_key=MISTRAL_API_KEY,
                base_url="https://api.mistral.ai/v1",
                temperature=0.3,
            )
        else:
            if not OPENAI_API_KEY:
                raise ValueError("Neither OPENAI_API_KEY nor MISTRAL_API_KEY is configured.")
            _chat_model = ChatOpenAI(
                model=LLM_MODEL,
                api_key=OPENAI_API_KEY,
                temperature=0.3,
            )
    return _chat_model

def get_openai_embeddings() -> OpenAIEmbeddings:
    """Lazy singleton for OpenAIEmbeddings model."""
    global _embeddings
    if _embeddings is None:
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is not configured.")
        _embeddings = OpenAIEmbeddings(
            model=EMBEDDING_MODEL,
            api_key=OPENAI_API_KEY,
        )
    return _embeddings

def _get_pool() -> ConnectionPool:
    """Lazy singleton connection pool (avoids a TCP+TLS handshake per request)."""
    global _pool
    if _pool is None:
        if not SUPABASE_DB_URL:
            raise ValueError("SUPABASE_DB_URL is not configured.")
        _pool = ConnectionPool(
            conninfo=SUPABASE_DB_URL,
            min_size=1,
            max_size=10,
            kwargs={"row_factory": dict_row},
            open=True,
        )
    return _pool


def get_db_connection():
    """Returns a pooled psycopg connection context manager.

    Usage is unchanged for callers: ``with get_db_connection() as conn:`` — the
    connection is returned to the pool (not closed) on exit. Blocking calls
    should be wrapped in ``asyncio.to_thread`` from async handlers.
    """
    return _get_pool().connection()
