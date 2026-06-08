# apps/extraction/app/rag/retrieval.py
import logging
import re
import httpx
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from app.rag.llm import get_openai_embeddings, get_chat_model, get_db_connection

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are Auriem's clinical diagnostics assistant, helping a patient understand their laboratory bloodwork history and medical guidelines.

Here is the context retrieved from the database to help you answer the user's question.

RETRIEVED PATIENT HISTORY (Previous & Current Lab Reports):
{patient_context}

RETRIEVED CLINICAL REFERENCE GUIDELINES (General Medical Reference):
{kb_context}

CURRENT PANEL (Latest Values):
{current_session_context}

RULES:
1. Be professional, clear, and supportive. Use plain language a non-clinician can understand.
2. Ground every statement in the patient history, reference guidelines, and current panel. Do not invent values.
3. Do NOT diagnose specific diseases or prescribe medication. Frame guidance as "topics to discuss with your healthcare provider."
4. When relevant, offer evidence-based lifestyle, dietary, and follow-up testing suggestions.
5. Format responses in concise Markdown (short paragraphs, bullet points, or numbered steps where helpful).
"""

def format_current_biomarkers(biomarkers: list[dict]) -> str:
    """Format the current session's biomarkers if provided."""
    if not biomarkers:
        return "No current session biomarker data provided."
    lines = []
    for b in biomarkers:
        name = b.get("displayName", b.get("canonicalName", "Unknown"))
        val = b.get("value", "N/A")
        unit = b.get("unit", "")
        status = b.get("status", "NORMAL")
        ref = b.get("referenceRange")
        ref_str = f" (Ref: {ref})" if ref else ""
        lines.append(f"- {name}: {val} {unit} — {status}{ref_str}")
    return "\n".join(lines)

async def retrieve_context(patient_id: str, query: str) -> tuple[str, str]:
    """Generates embedding for query and searches patient report and knowledge base chunks."""
    embeddings = get_openai_embeddings()
    try:
        query_vector = embeddings.embed_query(query)
        vector_str = f"[{','.join(map(str, query_vector))}]"
    except Exception as e:
        logger.error("Failed to generate query embedding: %s", e)
        return "", ""

    patient_context_lines = []
    kb_context_lines = []

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # 1. Search patient report chunks
                cur.execute(
                    """
                    SELECT "content", "chunk_type"
                    FROM "document_chunks"
                    WHERE "patient_id" = %s
                    ORDER BY "embedding" <=> %s::vector
                    LIMIT 5
                    """,
                    (patient_id, vector_str),
                )
                rows = cur.fetchall()
                for row in rows:
                    patient_context_lines.append(f"[{row['chunk_type']}] {row['content']}")

                # 2. Search knowledge base chunks
                cur.execute(
                    """
                    SELECT "content", "topic"
                    FROM "knowledge_base_chunks"
                    ORDER BY "embedding" <=> %s::vector
                    LIMIT 3
                    """,
                    (vector_str,),
                )
                rows = cur.fetchall()
                for row in rows:
                    kb_context_lines.append(f"Topic: {row['topic']}\n{row['content']}")

        patient_context = "\n\n".join(patient_context_lines) if patient_context_lines else "No historical records found for this patient."
        kb_context = "\n\n".join(kb_context_lines) if kb_context_lines else "No relevant medical guidelines found."
        return patient_context, kb_context
    except Exception as e:
        logger.error("Database retrieval failed: %s", e)
        return "Error loading history.", "Error loading guidelines."

async def fetch_pubmed_references(query: str, limit: int = 3) -> str:
    """
    Searches PubMed for PMIDs matching the query and returns formatted markdown references.
    """
    try:
        # Strip punctuation and special characters
        cleaned_query = re.sub(r'[^\w\s-]', '', query).strip()
        
        # Remove common conversational fillers and stopwords
        stop_words = {
            "what", "is", "why", "my", "explain", "how", "to", "treat", "what", "does", "mean",
            "levels", "level", "please", "can", "you", "tell", "me", "about", "the", "a", "an",
            "in", "of", "for", "with", "on", "at", "by", "from", "high", "low", "normal"
        }
        words = [w for w in cleaned_query.split() if w.lower() not in stop_words]
        search_term = " ".join(words)

        if not search_term:
            return ""

        advanced_query = f"{search_term} AND \"human\"[Filter] AND \"english\"[Filter]"
        search_params = {
            "db": "pubmed",
            "term": advanced_query,
            "retmax": limit,
            "retmode": "json",
            "sort": "relevance"
        }
        
        async with httpx.AsyncClient() as client:
            search_res = await client.get(
                "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi",
                params=search_params,
                timeout=4.0
            )
            search_res.raise_for_status()
            search_data = search_res.json()
            pmids = search_data.get("esearchresult", {}).get("idlist", [])
            
            if not pmids:
                # Retry search without humans/language filters if zero results
                search_params["term"] = search_term
                search_res = await client.get(
                    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi",
                    params=search_params,
                    timeout=4.0
                )
                search_res.raise_for_status()
                search_data = search_res.json()
                pmids = search_data.get("esearchresult", {}).get("idlist", [])

            if not pmids:
                return ""

            # Fetch Metadata using esummary
            summary_params = {
                "db": "pubmed",
                "id": ",".join(pmids),
                "retmode": "json"
            }
            summary_res = await client.get(
                "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi",
                params=summary_params,
                timeout=4.0
            )
            summary_res.raise_for_status()
            summary_data = summary_res.json()
            
            references = []
            for pmid in pmids:
                doc_info = summary_data.get("result", {}).get(pmid, {})
                if not doc_info:
                    continue
                title = doc_info.get("title", "").strip()
                title = re.sub(r'<[^>]*>', '', title)
                
                source = doc_info.get("source", "")
                pubdate = doc_info.get("pubdate", "")
                year = pubdate.split(" ")[0] if pubdate else ""
                
                url = f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"
                
                ref_str = f"- **[{title}]({url})** - *{source}* ({year})"
                references.append(ref_str)
            
            if references:
                return "\n\n---\n\n### 📚 Scientific References & Research\n" + "\n".join(references)
            return ""
            
    except Exception as e:
        logger.error(f"PubMed References Fetch Error: {e}")
        return ""

async def rag_chat(
    patient_id: str,
    messages: list[dict],
    user_input: str,
    biomarkers: list[dict] = None,
) -> str:
    """Retrieve context, build system instruction, query OpenAI, and append PubMed references."""
    # 1. Retrieve relevant contexts
    patient_context, kb_context = await retrieve_context(patient_id, user_input)
    current_session_context = format_current_biomarkers(biomarkers or [])

    # 2. Build system instruction
    system_instruction = _SYSTEM_PROMPT.format(
        patient_context=patient_context,
        kb_context=kb_context,
        current_session_context=current_session_context,
    )

    # 3. Build message list
    langchain_messages = [SystemMessage(content=system_instruction)]
    for m in messages:
        role = m.get("role")
        content = m.get("content")
        if role == "user":
            langchain_messages.append(HumanMessage(content=content))
        elif role == "assistant":
            langchain_messages.append(AIMessage(content=content))

    # Add the current user query if not already the last message in history
    if not messages or messages[-1].get("content") != user_input:
        langchain_messages.append(HumanMessage(content=user_input))

    # 4. Generate reply
    try:
        llm = get_chat_model()
        response = await llm.ainvoke(langchain_messages)
        reply = response.content

        # 5. Append PubMed references for clinical queries
        is_clinical = False
        if kb_context and "No relevant medical guidelines found." not in kb_context and "Error loading guidelines." not in kb_context:
            is_clinical = True
        
        if biomarkers and any(b.get("displayName", "").lower() in user_input.lower() for b in biomarkers):
            is_clinical = True

        if is_clinical:
            references = await fetch_pubmed_references(user_input)
            if references:
                reply += references

        return reply
    except Exception as e:
        logger.error("RAG OpenAI generation failed: %s", e)
        raise e
