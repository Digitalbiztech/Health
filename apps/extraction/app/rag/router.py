# apps/extraction/app/rag/router.py
import asyncio
import uuid
import json
import logging
from datetime import datetime
from typing import Optional, List, Any, Dict
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.rag.ingestion import ingest_extraction, split_text
from app.rag.retrieval import rag_chat
from app.rag.llm import get_openai_embeddings, get_db_connection

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/rag", tags=["RAG"])

# Pydantic Schemas
class ChatMessageModel(BaseModel):
    role: str
    content: str

class BiomarkerModel(BaseModel):
    displayName: str
    value: Any
    unit: Optional[str] = None
    referenceRange: Optional[str] = None
    status: str

class RagChatRequest(BaseModel):
    patient_id: str
    messages: List[ChatMessageModel]
    user_input: str
    biomarkers: Optional[List[BiomarkerModel]] = None
    user_role: Optional[str] = "patient"
    organization_id: Optional[str] = None

class RagChatResponse(BaseModel):
    reply: str
    provider: str

class IngestRequest(BaseModel):
    patient_id: str
    upload_id: str
    extraction_id: Optional[str] = None
    masked_text: str
    biomarkers: List[Dict[str, Any]]
    insights: List[Dict[str, Any]]
    report_date: Optional[str] = None

class IngestResponse(BaseModel):
    success: bool
    chunks_created: int

class KbIngestRequest(BaseModel):
    topic: str
    content: str
    metadata: Optional[Dict[str, Any]] = None

class KbIngestResponse(BaseModel):
    success: bool
    chunks_created: int
    chunk_id: str

@router.post("/chat", response_model=RagChatResponse)
async def endpoint_rag_chat(req: RagChatRequest):
    logger.info("RAG chat request for patient %s (role: %s)", req.patient_id, req.user_role)
    try:
        reply = await rag_chat(
            patient_id=req.patient_id,
            messages=[m.model_dump() for m in req.messages],
            user_input=req.user_input,
            biomarkers=[b.model_dump() for b in req.biomarkers] if req.biomarkers else None,
            user_role=req.user_role or "patient",
            organization_id=req.organization_id,
        )
        return RagChatResponse(reply=reply, provider="openai")
    except Exception as e:
        logger.error("RAG chat generation error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ingest", response_model=IngestResponse)
async def endpoint_ingest(req: IngestRequest):
    logger.info("Manual RAG ingest request for patient %s", req.patient_id)
    try:
        report_date = None
        if req.report_date:
            try:
                report_date = datetime.fromisoformat(req.report_date)
            except ValueError:
                logger.warning("Ignoring unparseable report_date: %s", req.report_date)
        count = await asyncio.to_thread(
            ingest_extraction,
            patient_id=req.patient_id,
            upload_id=req.upload_id,
            extraction_id=req.extraction_id,
            masked_text=req.masked_text,
            biomarkers=req.biomarkers,
            insights=req.insights,
            report_date=report_date,
        )
        return IngestResponse(success=True, chunks_created=count)
    except Exception as e:
        logger.error("RAG ingestion error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

def _kb_ingest_sync(topic: str, content: str, metadata: Dict[str, Any]) -> tuple[int, str]:
    """Blocking KB ingest (embed + insert). Run via asyncio.to_thread."""
    # Chunk long articles so retrieval is granular and we stay under the
    # embedding token limit. Short content yields a single chunk.
    pieces = split_text(content) or [content]
    embeddings = get_openai_embeddings()
    vectors = embeddings.embed_documents(pieces)

    first_chunk_id = None
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            for idx, (piece, vector) in enumerate(zip(pieces, vectors)):
                chunk_id = str(uuid.uuid4())
                if first_chunk_id is None:
                    first_chunk_id = chunk_id
                row_metadata = {**metadata, "chunk_index": idx, "chunk_count": len(pieces)}
                vector_str = f"[{','.join(map(str, vector))}]"
                cur.execute(
                    """
                    INSERT INTO "knowledge_base_chunks" (
                        "id", "topic", "content", "metadata", "embedding"
                    ) VALUES (%s, %s, %s, %s, %s::vector)
                    """,
                    (chunk_id, topic, piece, json.dumps(row_metadata), vector_str),
                )
        conn.commit()
    return len(pieces), first_chunk_id


@router.post("/knowledge-base/ingest", response_model=KbIngestResponse)
async def endpoint_kb_ingest(req: KbIngestRequest):
    logger.info("Knowledge base ingest request for topic %s", req.topic)
    try:
        count, first_chunk_id = await asyncio.to_thread(
            _kb_ingest_sync, req.topic, req.content, req.metadata or {}
        )
        return KbIngestResponse(success=True, chunks_created=count, chunk_id=first_chunk_id)
    except Exception as e:
        logger.error("Knowledge base ingestion error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def endpoint_health():
    db_status = "healthy"
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
    except Exception as e:
        db_status = f"unhealthy: {e}"

    return {
        "status": "online" if db_status == "healthy" else "degraded",
        "database": db_status,
        "provider": "openai",
    }
