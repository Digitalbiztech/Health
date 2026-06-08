# apps/extraction/app/rag/ingestion.py
import uuid
import json
import logging
from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.rag.llm import get_openai_embeddings, get_db_connection

logger = logging.getLogger(__name__)

def format_biomarkers(biomarkers: list[dict]) -> str:
    """Format biomarker list into a clear markdown-style block for embedding."""
    lines = ["Biomarker Panel Summary:"]
    for b in biomarkers:
        name = b.get("display_name", b.get("canonical_name", "Unknown"))
        val = b.get("value", "N/A")
        unit = b.get("unit", "")
        status = b.get("status", "NORMAL")
        ref = b.get("reference_range")
        ref_str = f" (Ref Range: {ref})" if ref else ""
        lines.append(f"- {name}: {val} {unit} — {status}{ref_str}")
    return "\n".join(lines)

def ingest_extraction(
    patient_id: str,
    upload_id: str,
    extraction_id: str,
    masked_text: str,
    biomarkers: list[dict],
    insights: list[dict],
) -> int:
    """Split, embed, and store extraction components in pgvector."""
    if not patient_id:
        logger.warning("No patient_id provided for RAG ingestion. Skipping.")
        return 0

    embeddings = get_openai_embeddings()
    chunks_to_insert = []

    # 1. Split and process full report text
    if masked_text and masked_text.strip():
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=100,
            separators=["\n\n", "\n", ". ", " "],
        )
        text_chunks = text_splitter.split_text(masked_text)
        for idx, text in enumerate(text_chunks):
            chunks_to_insert.append({
                "chunk_type": "report_text",
                "chunk_index": idx,
                "content": text,
                "metadata": json.dumps({"source": "report_text"}),
            })

    # 2. Format and embed biomarker summary
    if biomarkers:
        biomarker_text = format_biomarkers(biomarkers)
        chunks_to_insert.append({
            "chunk_type": "biomarker_summary",
            "chunk_index": 0,
            "content": biomarker_text,
            "metadata": json.dumps({"source": "biomarker_summary"}),
        })

    # 3. Process clinical insights
    if insights:
        for idx, insight in enumerate(insights):
            title = insight.get("title", "")
            body = insight.get("body", "")
            tone = insight.get("tone", "neutral")
            content = f"Clinical Insight: {title}\nSummary: {body}\nTone: {tone}"
            chunks_to_insert.append({
                "chunk_type": "clinical_insight",
                "chunk_index": idx,
                "content": content,
                "metadata": json.dumps({"source": "clinical_insight", "tone": tone}),
            })

    if not chunks_to_insert:
        logger.info("No content to ingest for extraction %s", extraction_id)
        return 0

    # 4. Generate embeddings for all contents
    texts = [c["content"] for c in chunks_to_insert]
    try:
        embedded_vectors = embeddings.embed_documents(texts)
    except Exception as e:
        logger.error("Failed to generate embeddings via OpenAI: %s", e)
        raise e

    for i, vector in enumerate(embedded_vectors):
        chunks_to_insert[i]["embedding"] = vector

    # 5. Insert into Database inside a transaction
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Idempotency: clean up previous chunks for this upload
                cur.execute(
                    'DELETE FROM "document_chunks" WHERE "upload_id" = %s',
                    (upload_id,),
                )
                
                # Batch insert
                for chunk in chunks_to_insert:
                    chunk_id = str(uuid.uuid4())
                    # Convert python list to pgvector literal format '[0.1, 0.2, ...]'
                    vector_str = f"[{','.join(map(str, chunk['embedding']))}]"
                    
                    cur.execute(
                        """
                        INSERT INTO "document_chunks" (
                            "id", "patient_id", "upload_id", "extraction_id", 
                            "chunk_type", "chunk_index", "content", "metadata", "embedding"
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::vector)
                        """,
                        (
                            chunk_id,
                            patient_id,
                            upload_id,
                            extraction_id,
                            chunk["chunk_type"],
                            chunk["chunk_index"],
                            chunk["content"],
                            chunk["metadata"],
                            vector_str,
                        ),
                    )
            conn.commit()
        logger.info(
            "RAG Ingestion: Embedded and saved %d chunks for patient %s (extraction %s)",
            len(chunks_to_insert),
            patient_id,
            extraction_id,
        )
        return len(chunks_to_insert)
    except Exception as e:
        logger.error("Failed to save ingested RAG chunks to database: %s", e)
        raise e
