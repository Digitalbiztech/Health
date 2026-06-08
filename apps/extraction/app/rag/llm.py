# apps/extraction/app/rag/llm.py
import logging
import psycopg
from psycopg.rows import dict_row
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from app.rag.config import (
    OPENAI_API_KEY,
    LLM_MODEL,
    EMBEDDING_MODEL,
    SUPABASE_DB_URL,
)

logger = logging.getLogger(__name__)

_chat_model = None
_embeddings = None

def get_chat_model() -> ChatOpenAI:
    """Lazy singleton for ChatOpenAI model."""
    global _chat_model
    if _chat_model is None:
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is not configured.")
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

def get_db_connection():
    """Returns a direct psycopg connection to the Supabase database."""
    if not SUPABASE_DB_URL:
        raise ValueError("SUPABASE_DB_URL is not configured.")
    # Use dict_row for easier access to columns as keys
    conn = psycopg.connect(SUPABASE_DB_URL, row_factory=dict_row)
    return conn
