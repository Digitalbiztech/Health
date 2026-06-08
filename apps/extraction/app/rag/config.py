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

EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "openai").strip().lower()
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small").strip()
EMBEDDING_DIMENSION = int(os.getenv("EMBEDDING_DIMENSION", "1536"))

# Database Configuration
SUPABASE_DB_URL = os.getenv("SUPABASE_DB_URL", "").strip()

if not OPENAI_API_KEY:
    logger.warning("OPENAI_API_KEY is not set. RAG features will fail or run in degraded mode.")

if not SUPABASE_DB_URL:
    logger.warning("SUPABASE_DB_URL is not set. RAG vector store will be unavailable.")
