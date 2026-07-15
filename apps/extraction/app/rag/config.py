# apps/extraction/app/rag/config.py
import os
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# LLM and Embeddings Provider Config (restricted to openai)
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai").strip().lower()
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "").strip()
MISTRAL_MODEL = os.getenv("MISTRAL_MODEL", "mistral-large-latest").strip()

EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "openai").strip().lower()
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small").strip()
EMBEDDING_DIMENSION = int(os.getenv("EMBEDDING_DIMENSION", "1536"))

# Database Configuration
SUPABASE_DB_URL = os.getenv("SUPABASE_DB_URL", "").strip()

# Service-to-service auth. When set, incoming requests must carry a matching
# X-Service-Secret header (see app/security.py). Left empty in local dev.
SERVICE_SECRET = os.getenv("EXTRACTION_SERVICE_SECRET", "").strip()

# Retrieval / generation tunables
RAG_MAX_DISTANCE = float(os.getenv("RAG_MAX_DISTANCE", "0.6"))
ENABLE_QUERY_REWRITE = os.getenv("ENABLE_QUERY_REWRITE", "true").strip().lower() in ("1", "true", "yes")
ENABLE_PUBMED = os.getenv("ENABLE_PUBMED", "true").strip().lower() in ("1", "true", "yes")
NCBI_API_KEY = os.getenv("NCBI_API_KEY", "").strip()
RAG_DEBUG = os.getenv("RAG_DEBUG", "false").strip().lower() in ("1", "true", "yes")

if not OPENAI_API_KEY and not MISTRAL_API_KEY:
    logger.warning("Neither OPENAI_API_KEY nor MISTRAL_API_KEY is set. RAG features will fail or run in degraded mode.")

if not SUPABASE_DB_URL:
    logger.warning("SUPABASE_DB_URL is not set. RAG vector store will be unavailable.")

# Dimensions of known embedding models. The pgvector column is vector(1536), so
# a model whose output dim differs would fail inserts at runtime — fail loud at
# startup instead.
_KNOWN_EMBEDDING_DIMS = {
    "text-embedding-3-small": 1536,
    "text-embedding-3-large": 3072,
    "text-embedding-ada-002": 1536,
}
SCHEMA_VECTOR_DIM = 1536


def validate_embedding_dim() -> None:
    """Guard that the configured embedding model matches the schema/config dim."""
    expected = _KNOWN_EMBEDDING_DIMS.get(EMBEDDING_MODEL)
    if expected is None:
        logger.warning(
            "Embedding model '%s' is not in the known-dimension map; cannot verify "
            "it matches the vector(%d) column.", EMBEDDING_MODEL, SCHEMA_VECTOR_DIM,
        )
        return
    if expected != EMBEDDING_DIMENSION:
        logger.error(
            "EMBEDDING_DIMENSION=%d does not match model '%s' (dim %d).",
            EMBEDDING_DIMENSION, EMBEDDING_MODEL, expected,
        )
    if expected != SCHEMA_VECTOR_DIM:
        raise ValueError(
            f"Embedding model '{EMBEDDING_MODEL}' produces dim {expected}, but the "
            f"document_chunks/knowledge_base_chunks column is vector({SCHEMA_VECTOR_DIM}). "
            "Inserts would fail — change the model or migrate the column."
        )
