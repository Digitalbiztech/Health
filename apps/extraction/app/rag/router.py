# apps/extraction/app/rag/router.py
import uuid
import json
import logging
from typing import Optional, List, Any, Dict
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.rag.ingestion import ingest_extraction
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

class RagChatResponse(BaseModel):
    reply: str
    provider: str

class IngestRequest(BaseModel):
    patient_id: str
    upload_id: str
    extraction_id: str
    masked_text: str
    biomarkers: List[Dict[str, Any]]
    insights: List[Dict[str, Any]]

class IngestResponse(BaseModel):
    success: bool
    chunks_created: int

class KbIngestRequest(BaseModel):
    topic: str
    content: str
    metadata: Optional[Dict[str, Any]] = None

class KbIngestResponse(BaseModel):
    success: bool
    chunk_id: str

@router.post("/chat", response_model=RagChatResponse)
async def endpoint_rag_chat(req: RagChatRequest):
    logger.info("RAG chat request for patient %s", req.patient_id)
    try:
        reply = await rag_chat(
            patient_id=req.patient_id,
            messages=[m.model_dump() for m in req.messages],
            user_input=req.user_input,
            biomarkers=[b.model_dump() for b in req.biomarkers] if req.biomarkers else None,
        )
        return RagChatResponse(reply=reply, provider="openai")
    except Exception as e:
        logger.error("RAG chat generation error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ingest", response_model=IngestResponse)
async def endpoint_ingest(req: IngestRequest):
    logger.info("Manual RAG ingest request for patient %s", req.patient_id)
    try:
        count = ingest_extraction(
            patient_id=req.patient_id,
            upload_id=req.upload_id,
            extraction_id=req.extraction_id,
            masked_text=req.masked_text,
            biomarkers=req.biomarkers,
            insights=req.insights,
        )
        return IngestResponse(success=True, chunks_created=count)
    except Exception as e:
        logger.error("RAG ingestion error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/knowledge-base/ingest", response_model=KbIngestResponse)
async def endpoint_kb_ingest(req: KbIngestRequest):
    logger.info("Knowledge base ingest request for topic %s", req.topic)
    try:
        embeddings = get_openai_embeddings()
        vector = embeddings.embed_query(req.content)
        vector_str = f"[{','.join(map(str, vector))}]"
        chunk_id = str(uuid.uuid4())
        
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO "knowledge_base_chunks" (
                        "id", "topic", "content", "metadata", "embedding"
                    ) VALUES (%s, %s, %s, %s, %s::vector)
                    """,
                    (
                        chunk_id,
                        req.topic,
                        req.content,
                        json.dumps(req.metadata or {}),
                        vector_str,
                    ),
                )
            conn.commit()
            
        return KbIngestResponse(success=True, chunk_id=chunk_id)
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
