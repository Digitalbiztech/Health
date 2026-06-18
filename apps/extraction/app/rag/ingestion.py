# apps/extraction/app/rag/ingestion.py
import re
import uuid
import json
import logging
from datetime import datetime
from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.rag.llm import get_openai_embeddings, get_db_connection
from app.rag.formatting import format_biomarker_line

logger = logging.getLogger(__name__)

# Max number of chunks embedded per OpenAI request (bounds payload/token size).
EMBED_BATCH_SIZE = 96


def split_text(text: str, chunk_size: int = 800, chunk_overlap: int = 100) -> list[str]:
    """Reusable recursive splitter (shared by report text and KB articles)."""
    if not text or not text.strip():
        return []
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", " "],
    )
    return splitter.split_text(text)


def format_biomarkers(biomarkers: list[dict]) -> str:
    """Format biomarker list into a clear markdown-style block for embedding."""
    lines = ["Biomarker Panel Summary:"]
    lines.extend(format_biomarker_line(b) for b in biomarkers)
    return "\n".join(lines)


# Map insight tone vocabulary onto a normalized risk_level for metadata filtering.
_TONE_TO_RISK = {
    "critical": "high",
    "alert": "high",
    "warning": "moderate",
    "caution": "moderate",
    "neutral": "low",
    "info": "low",
    "positive": "low",
    "good": "low",
}


def _biomarker_metadata(biomarkers: list[dict]) -> list[dict]:
    """Compact, queryable per-biomarker facts to store on the summary chunk."""
    facts = []
    for b in biomarkers:
        facts.append({
            "name": b.get("display_name") or b.get("canonical_name") or "Unknown",
            "status": b.get("status", "NORMAL"),
            "category": b.get("category"),
        })
    return facts


# Labels that precede a report/collection date, highest priority first. Collection
# date best represents when the sample was taken; report/result date is a fallback.
_DATE_LABELS = [
    r"collection\s+date",
    r"date\s+collected",
    r"collected\s+on",
    r"collected",
    r"specimen\s+collected",
    r"draw\s+date",
    r"report\s+date",
    r"reported\s+on",
    r"reported",
    r"result\s+date",
    r"date\s+of\s+report",
]

# Date token immediately following a label (numeric, dashed-month, or spelled-out).
_DATE_TOKEN = (
    r"(\d{4}[-/]\d{1,2}[-/]\d{1,2}"          # 2024-01-15 / 2024/1/5
    r"|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}"        # 15/01/2024 / 1-5-24
    r"|\d{1,2}[-\s][A-Za-z]{3,9}[-\s]\d{2,4}"  # 15-Jan-2024 / 15 January 2024
    r"|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})"   # Jan 15, 2024
)

_DATE_FORMATS = [
    "%Y-%m-%d", "%Y/%m/%d",
    "%d/%m/%Y", "%m/%d/%Y", "%d/%m/%y", "%m/%d/%y",
    "%d-%m-%Y", "%m-%d-%Y", "%d-%m-%y", "%m-%d-%y",
    "%d-%b-%Y", "%d %b %Y", "%d-%B-%Y", "%d %B %Y",
    "%b %d, %Y", "%b %d %Y", "%B %d, %Y", "%B %d %Y",
]


def _parse_date_token(token: str) -> datetime | None:
    token = token.strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(token, fmt)
        except ValueError:
            continue
    return None


def parse_report_date(raw_text: str | None) -> datetime | None:
    """Best-effort: pull a collection/report date from the RAW (pre-masking) text.

    Dates are stripped by PHI masking, so this must run on the unmasked text.
    Returns None when nothing parseable is found. Result is stored only in the
    structured ``report_date`` column — never re-embedded into chunk content.
    """
    if not raw_text:
        return None
    for label in _DATE_LABELS:
        pattern = re.compile(label + r"\s*[:\-]?\s*" + _DATE_TOKEN, re.IGNORECASE)
        match = pattern.search(raw_text)
        if match:
            parsed = _parse_date_token(match.group(1))
            if parsed:
                return parsed
    return None


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")


def derive_report_type(biomarkers: list[dict]) -> str | None:
    """Infer a coarse report_type from the biomarkers' categories.

    Single category → its slug (e.g. ``lipid_panel``); a dominant category
    (≥60%) → that; multiple mixed categories → ``comprehensive_panel``.
    """
    categories = [b.get("category") for b in biomarkers if b.get("category")]
    if not categories:
        return None
    distinct = set(categories)
    if len(distinct) == 1:
        return _slug(next(iter(distinct)))
    top = max(distinct, key=lambda c: categories.count(c))
    if categories.count(top) / len(categories) >= 0.6:
        return _slug(top)
    return "comprehensive_panel"

def ingest_extraction(
    patient_id: str,
    upload_id: str,
    extraction_id: str | None,
    masked_text: str,
    biomarkers: list[dict],
    insights: list[dict],
    report_date: datetime | None = None,
) -> int:
    """Split, embed, and store extraction components in pgvector."""
    if not patient_id:
        logger.warning("No patient_id provided for RAG ingestion. Skipping.")
        return 0

    embeddings = get_openai_embeddings()
    chunks_to_insert = []

    # Structured metadata derived once for every chunk in this extraction.
    report_type = derive_report_type(biomarkers or [])

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
            "metadata": json.dumps({
                "source": "biomarker_summary",
                "biomarkers": _biomarker_metadata(biomarkers),
            }),
        })

        # 2b. One embedded chunk per biomarker — enables granular semantic
        # retrieval and GIN-filtered structured queries (e.g. status=high).
        for idx, b in enumerate(biomarkers):
            name = b.get("display_name") or b.get("canonical_name") or "Unknown"
            val = b.get("value", "N/A")
            unit = b.get("unit", "")
            status = b.get("status", "NORMAL")
            ref = b.get("reference_range")
            ref_str = f" (Ref: {ref})" if ref else ""
            chunks_to_insert.append({
                "chunk_type": "biomarker",
                "chunk_index": idx,
                "content": f"{name}: {val} {unit} — {status}{ref_str}",
                "metadata": json.dumps({
                    "source": "biomarker",
                    "biomarker": b.get("canonical_name") or _slug(name),
                    "status": status,
                    "category": b.get("category"),
                    "unit": unit,
                }),
            })

    # 3. Process clinical insights
    if insights:
        for idx, insight in enumerate(insights):
            title = insight.get("title", "")
            body = insight.get("body", "")
            tone = insight.get("tone", "neutral")
            risk_level = _TONE_TO_RISK.get((tone or "").lower(), "moderate")
            content = f"Clinical Insight: {title}\nSummary: {body}\nTone: {tone}"
            chunks_to_insert.append({
                "chunk_type": "clinical_insight",
                "chunk_index": idx,
                "content": content,
                "metadata": json.dumps({
                    "source": "clinical_insight",
                    "tone": tone,
                    "risk_level": risk_level,
                }),
            })

    if not chunks_to_insert:
        logger.info("No content to ingest for extraction %s", extraction_id)
        return 0

    # 4. Generate embeddings for all contents, batched to stay under the
    # embedding request token/size limit on large reports.
    texts = [c["content"] for c in chunks_to_insert]
    try:
        embedded_vectors = []
        for start in range(0, len(texts), EMBED_BATCH_SIZE):
            batch = texts[start:start + EMBED_BATCH_SIZE]
            embedded_vectors.extend(embeddings.embed_documents(batch))
    except Exception as e:
        logger.error("Failed to generate embeddings via OpenAI: %s", e)
        raise e

    for i, vector in enumerate(embedded_vectors):
        chunks_to_insert[i]["embedding"] = vector

    # 5. Insert into Database inside a transaction (single executemany batch).
    insert_rows = [
        (
            str(uuid.uuid4()),
            patient_id,
            upload_id,
            extraction_id,
            upload_id,  # subselect arg for organization_id
            report_type,
            report_date,
            chunk["chunk_type"],
            chunk["chunk_index"],
            chunk["content"],
            chunk["metadata"],
            f"[{','.join(map(str, chunk['embedding']))}]",
        )
        for chunk in chunks_to_insert
    ]
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Idempotency: clean up previous chunks for this upload
                cur.execute(
                    'DELETE FROM "document_chunks" WHERE "upload_id" = %s',
                    (upload_id,),
                )
                cur.executemany(
                    """
                    INSERT INTO "document_chunks" (
                        "id", "patient_id", "upload_id", "extraction_id",
                        "organization_id", "report_type", "report_date",
                        "chunk_type", "chunk_index", "content", "metadata", "embedding"
                    ) VALUES (
                        %s, %s, %s, %s,
                        (SELECT "organization_id" FROM "uploads" WHERE "id" = %s),
                        %s, %s,
                        %s, %s, %s, %s, %s::vector
                    )
                    """,
                    insert_rows,
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
