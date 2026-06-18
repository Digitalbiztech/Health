# RAG Implementation — Architecture Notes & Review

> Scope: `apps/extraction/app/rag/` (FastAPI microservice) plus its callers in
> `apps/api` (Node gateway) and the pgvector schema in `apps/api/prisma`.
> Generated 2026-06-17.
>
> **Changelog:** see [§9](#9-changelog) for implemented changes.

---

## 1. High-level architecture

```
                        ┌─────────────────────────────────────────────┐
  Browser (web)         │  apps/api  (Node / Express + Prisma)         │
      │  POST /chat     │  chatService.generateChatReply()             │
      ▼                 │   • authn + resolve patient_id (authz)       │
  ─────────────────────►│   • persist chat messages                    │
                        │   • ragService.chat() ──► HTTP ─────────────┐│
                        └──────────────────────────────────────────────┘│
                                                                         │
                        ┌────────────────────────────────────────────────▼─┐
                        │  apps/extraction  (FastAPI microservice)          │
                        │  app/rag/router.py                                │
                        │   POST /rag/chat              (retrieval.rag_chat)│
                        │   POST /rag/ingest            (ingestion)         │
                        │   POST /rag/knowledge-base/ingest                 │
                        │   GET  /rag/health                                │
                        └───────────┬───────────────────────────┬──────────┘
                                    │                            │
                        OpenAI embeddings + chat        Supabase Postgres + pgvector
                        (text-embedding-3-small,        document_chunks (patient-scoped)
                         gpt-4o-mini)                   knowledge_base_chunks (global)
```

- **Gateway**: `apps/api` is the only authenticated entry point. It forces
  `patient_id` to the caller's own id for `PATIENT` principals
  (`chatService.ts:221`) and maps `STAFF` → `user_role: "doctor"`.
- **Microservice**: `apps/extraction` does the actual embedding, retrieval and
  generation. It has **no authentication of its own** (see §6).
- **Store**: Supabase Postgres with the `vector` extension. Two tables, both
  with `vector(1536)` columns and HNSW cosine indexes
  (`migrations/.../add_document_chunks/migration.sql`).

---

## 2. Components (file by file)

### `config.py`
- Loads env via `dotenv`. Provider is hard-locked to OpenAI.
- `LLM_MODEL=gpt-4o-mini`, `EMBEDDING_MODEL=text-embedding-3-small`,
  `EMBEDDING_DIMENSION=1536`, `SUPABASE_DB_URL`.
- Logs warnings (does not fail fast) if `OPENAI_API_KEY` / `SUPABASE_DB_URL`
  are missing → "degraded mode".

### `llm.py`
- Lazy singletons `get_chat_model()` (temp 0.3) and `get_openai_embeddings()`.
- `get_db_connection()` returns a **fresh, synchronous** `psycopg.connect(...)`
  per call, with `dict_row` row factory. No pooling.

### `ingestion.py` — write path
Triggered automatically at the end of `/extract` (`routers/extract.py:69-86`,
non-fatal/best-effort) and manually via `POST /rag/ingest`.
Builds chunks of three `chunk_type`s:
1. `report_text` — `masked_text` split by `RecursiveCharacterTextSplitter`
   (`chunk_size=500`, `chunk_overlap=100`, separators `["\n\n","\n",". "," "]`).
2. `biomarker_summary` — one chunk, formatted markdown of the panel.
3. `clinical_insight` — one chunk per insight (`title`/`body`/`tone`).

Then `embeddings.embed_documents(texts)` (single batch), and inside one
transaction: `DELETE FROM document_chunks WHERE upload_id = %s` (idempotency)
followed by row-by-row `INSERT`. Vectors are serialized to the pgvector literal
`"[v1,v2,...]"` and cast `%s::vector`.

### `retrieval.py` — read path
- `retrieve_context(patient_id, query)`:
  - Embeds `query` (the raw latest user input only).
  - Patient chunks: `SELECT content, chunk_type FROM document_chunks
    WHERE patient_id = %s ORDER BY embedding <=> %s::vector LIMIT 5`.
  - KB chunks: `... FROM knowledge_base_chunks ORDER BY embedding <=> %s::vector
    LIMIT 3` (no patient filter — global).
  - Returns formatted strings, or placeholder/error strings on failure.
- `format_current_biomarkers(...)` formats the request-supplied "current panel".
- `rag_chat(...)`:
  1. retrieve patient + KB context;
  2. choose `_SYSTEM_PROMPT` (patient) or `_DOCTOR_SYSTEM_PROMPT` (doctor) and
     `.format()` the three context blocks into it;
  3. rebuild LangChain message list from history + current input;
  4. `await llm.ainvoke(...)`;
  5. if "clinical" (KB hit, or a biomarker name appears in the query), append
     `fetch_pubmed_references(...)`.
- `fetch_pubmed_references(...)`: strips punctuation + a hardcoded stopword set,
  calls NCBI `esearch` then `esummary` (each `timeout=4.0`), formats markdown
  links. Retries `esearch` once without the human/english filters.

### `router.py`
FastAPI routes + Pydantic schemas. `/knowledge-base/ingest` embeds a single
blob and inserts one row. `/health` does `SELECT 1`.

---

## 3. Data model

| Table | Scope | Key cols | Index |
|-------|-------|----------|-------|
| `document_chunks` | per patient (FK → patients/uploads/extractions, `ON DELETE CASCADE`) | `patient_id`, `upload_id`, `extraction_id`, `chunk_type`, `chunk_index`, `content`, `metadata` JSONB, `embedding vector(1536)` | btree `(patient_id, chunk_type)`; HNSW `vector_cosine_ops` |
| `knowledge_base_chunks` | global | `topic`, `content`, `metadata`, `embedding vector(1536)` | HNSW `vector_cosine_ops` |

Note: `extraction_id` is intentionally `NULL` on the auto-ingest path (the
`extractions` row is created by the API *after* extraction returns).

---

## 4. Request flow (chat)

1. `POST /api/.../chat` → `generateChatReply` authenticates, resolves
   `targetPatientId`, persists the user message, loads full session history.
2. Calls `ragService.chat({ patient_id, messages: history[:-1], user_input,
   biomarkers, user_role })` over HTTP (with a timeout/abort).
3. Extraction `/rag/chat` → `rag_chat` retrieves, generates, optionally appends
   PubMed refs, returns `{ reply, provider: "openai" }`.
4. On any RAG error the API **falls back to its own LLM provider chain**
   (`chatService.ts:204`), so RAG failure is non-fatal end-to-end.

---

## 5. Strengths

- Clean separation: ingestion / retrieval / llm / routing are isolated modules.
- Parameterized SQL everywhere (no SQL injection in the queries themselves).
- Idempotent ingestion keyed by `upload_id` (re-processing replaces, not dupes).
- Patient isolation **at the query level** (`WHERE patient_id = %s`) for
  `document_chunks`, backed by FK cascade for cleanup.
- Best-effort ingestion + API-side LLM fallback → RAG outages don't break chat.
- Role-aware prompting (patient vs clinician) with sensible safety rules
  ("don't diagnose", "discuss with provider").
- HNSW cosine index present from day one; embeddings batched on ingest.

---

## 6. Weak points & improvement opportunities

> **Status (2026-06-18): §6.1–6.7 addressed** — see the §9 changelog
> "RAG hardening" entry. Remaining/partial items are noted inline below with
> ✅ (done) / ⚠️ (partial) markers.

### 6.1 Security (highest priority) ✅
- ✅ Shared-secret service auth (`X-Service-Secret`, FastAPI dependency).
- ✅ KB-ingest hole closed by the same auth gate.
- ✅ Retrieved content wrapped in delimited untrusted-data blocks + guard.
- **No authentication on the extraction service.** `/rag/chat`, `/rag/ingest`
  and `/rag/knowledge-base/ingest` trust the `patient_id` in the request body.
  Anyone who can reach the service (SSRF, misconfigured network, internal
  attacker) can read or poison **any patient's PHI** by passing an arbitrary
  `patient_id`. All authz lives in the Node gateway only.
  → Add service-to-service auth (shared secret / mTLS / signed JWT from the
  gateway) and verify it in FastAPI middleware. Never rely solely on network
  isolation for a PHI system.
- **Open knowledge-base ingest = prompt/misinformation poisoning.** KB chunks
  are global and injected verbatim into the system prompt for every patient.
  An attacker who can hit `/rag/knowledge-base/ingest` can plant misleading
  "clinical guidelines" or prompt-injection payloads.
  → Lock down to admin role; review/moderate KB content.
- **Prompt injection from retrieved content.** Patient PDF text and KB content
  are interpolated directly into the system prompt with no delimiting or
  instruction-isolation. A malicious/garbled report could carry "ignore prior
  instructions" text.
  → Wrap retrieved context in clearly delimited, untrusted-data blocks; consider
  an input guard. Keep instructions above retrieved data and state that the data
  is reference-only.

### 6.2 Retrieval quality ✅
- ✅ distance threshold (`RAG_MAX_DISTANCE`); ✅ over-fetch + content dedup +
  per-`chunk_type` quota; ✅ history-aware query rewriting (`ENABLE_QUERY_REWRITE`);
  ✅ recency tie-break (§6.5); ✅ KB content now chunked. ⚠️ no cross-encoder
  rerank/MMR (dedup+quota used instead).
- **No similarity threshold.** Queries always return top-5/top-3 regardless of
  distance; the only "empty" path is literally zero rows. Irrelevant chunks get
  forced into context → hallucination/anchoring risk.
  → Add a max-distance cutoff (`WHERE embedding <=> q < threshold`) and/or score
  logging to tune it.
- **Retrieval ignores conversation history.** Only the raw `user_input` is
  embedded. Follow-ups like "what about that one?" retrieve poorly.
  → Add query condensation/rewriting (history + question → standalone query).
- **No reranking / MMR / dedup.** Overlapping `report_text` chunks can crowd out
  the `biomarker_summary` and `clinical_insight` chunks. `chunk_type` is fetched
  but never used to weight or guarantee coverage.
  → Consider per-type quotas, a cross-encoder rerank, or MMR for diversity.
- **No recency weighting.** Old and latest reports rank equally; "latest panel"
  is only available because the request passes current biomarkers separately.
  → Incorporate `created_at`/recency into ranking for longitudinal questions.
- **KB content is never chunked.** `/knowledge-base/ingest` embeds the whole
  blob as one vector → coarse retrieval and risk of exceeding the embedding
  token limit on long articles.
  → Reuse the splitter for KB content too.

### 6.3 Concurrency / performance ✅
- ✅ `psycopg_pool` connection pool; ✅ blocking DB/ingest offloaded via
  `asyncio.to_thread`; ✅ async query embedding (`aembed_query`); ✅ batched
  `embed_documents` + `executemany` insert. ⚠️ DB driver remains sync-in-thread
  (no full asyncpg rewrite — by design).
- **Blocking I/O inside async handlers.** `get_db_connection()` (sync psycopg)
  and `OpenAIEmbeddings.embed_query/embed_documents` (sync client) are called
  directly inside `async def` functions. These block the event loop and
  throttle the whole service under load.
  → Use an async driver (`psycopg` async / asyncpg) or `run_in_executor`, and
  the async OpenAI/LangChain clients.
- **`ingest_extraction` is synchronous but called from the async `/extract`
  handler** (`extract.py:72`) → blocks the loop during embedding + inserts.
- **No connection pooling.** A new TCP+TLS Postgres connection per request.
  → Introduce a pool (e.g. `psycopg_pool`) shared at app scope.
- **Row-by-row INSERT** on ingest; use `executemany`/`COPY` for large reports.
- **`embed_documents` single call** for an entire PDF can exceed embedding
  batch/token limits on large documents — no chunk-count batching.

### 6.4 Reliability / correctness ✅
- ✅ retrieval errors no longer injected as context (neutral placeholder);
  ✅ single shared `format_biomarker_line` (snake+camel coalesced);
  ✅ PubMed env-gated (`ENABLE_PUBMED`) + TTL-cached + tighter budget + optional
  `NCBI_API_KEY`; ✅ startup embedding-dimension guard.
- **Errors become "context".** On DB failure `retrieve_context` returns
  `"Error loading history."` / `"Error loading guidelines."` which are then
  embedded into the prompt as if they were retrieved facts. The model may treat
  them as content.
  → Distinguish error vs empty; on error, omit the block or surface a failure.
- **Biomarker field-name mismatch.** Ingestion reads **snake_case**
  (`display_name`, `canonical_name`, `reference_range` in `format_biomarkers`)
  while retrieval/`format_current_biomarkers` reads **camelCase**
  (`displayName`, `referenceRange`). If the normalized object shape ever drifts,
  one side silently falls back to `Unknown`/`N/A`. Two near-duplicate formatters
  also invite divergence.
  → Single source of truth for the biomarker shape + one shared formatter.
- **PubMed adds latency + a hard external dependency to "clinical" replies.**
  Up to 2–3 sequential NCBI calls at 4s each on the response critical path, no
  caching, weak stopword heuristic for query building, and no rate-limit/API-key
  handling for NCBI.
  → Make it optional/async-appended, cache by query, add a global budget, and
  back off gracefully.
- **`EMBEDDING_DIMENSION` config is decorative.** The schema hardcodes
  `vector(1536)`. Switching embedding models/dims would break inserts with no
  guardrail.
  → Validate dim at startup against the configured model, or make the column
  configurable via migration.

### 6.5 Metadata (stored but unused)
> **Status (2026-06-18): largely addressed** — see §8 + §9 changelog. Done:
> filterable columns added and now **populated** (`organization_id` backfilled,
> `report_type` derived from categories, `report_date` parsed from raw text),
> GIN indexes on both `metadata` columns, richer JSONB (per-biomarker
> status/category, insight `risk_level`), per-biomarker embedded chunks,
> retrieval reads `metadata` + date with a recency tie-break, and
> retrieval-time org isolation. Still deferred: chat-history vectorization (§8.4).

The `metadata` JSONB column **was** plumbed on the **write** side and ignored on
the **read** side. The original findings (now mostly resolved):
- **Written**: in `ingestion.py`, every chunk gets `{"source": <chunk_type>}`
  (plus `"tone"` for `clinical_insight`); KB chunks store the caller-supplied
  `req.metadata`.
- **Never read**: retrieval selects only `content, chunk_type` (`retrieval.py:85`)
  and `content, topic` (`retrieval.py:99`). `metadata` appears in no `SELECT`,
  no `WHERE`, and no ranking. It is effectively write-only dead weight, and the
  `tone` / KB metadata are stored then discarded.
- **Redundant content**: the one thing it does store — `metadata.source` — just
  duplicates the existing `chunk_type` column.
- **Missed high-value fields**: the metadata that would actually enable the
  improvements in §6.2 isn't captured:
  - `report_date` / `created_at` per chunk → needed for **recency weighting**
    (currently nothing ties a chunk to which report it came from at query time).
  - biomarker name(s), panel name, source page, extraction confidence → would
    enable **metadata pre-filtering** and per-`chunk_type` quotas.
- **No index**: there is no GIN index on either `metadata` column, so even if
  retrieval started filtering on JSONB it would force a sequential scan.

→ Either drop the column if it stays unused, or (better) store report date +
biomarker identity + page, add a GIN index, and use it for recency-aware ranking
and optional pre-filtering.

### 6.6 Cost / context growth ✅
- ✅ history windowed to the last `MAX_HISTORY_MESSAGES` (12) turns in
  `chatService.ts`; ✅ query-embedding TTL cache in retrieval.
- **Full session history sent every turn** (`messageHistory`), no truncation or
  summarization → unbounded token growth on long chats.
  → Window or summarize old turns.
- **Query re-embedded every turn**, no cache for repeated/identical questions.

### 6.7 Observability / privacy ⚠️
- ✅ retrieval telemetry behind `RAG_DEBUG` (candidate/selected ids, distances,
  chunk_types). ⚠️ no formal eval harness yet.
- `patient_id` is logged in plaintext in several handlers — acceptable as an
  opaque id, but worth confirming it isn't PII and that logs are access-controlled.
- No retrieval telemetry (scores, hit counts, which chunk_types were used) →
  hard to evaluate or regression-test RAG quality.
  → Log distances + chunk ids (behind a flag) and add an eval harness.

---

## 7. Suggested priority order

1. **Authenticate the extraction service** and lock down KB ingest (PHI/safety).
2. **Delimit/guard retrieved content** against prompt injection.
3. **Fix blocking I/O + add connection pooling** (stability under load).
4. **Add a similarity threshold + history-aware query rewriting** (answer quality).
5. **Unify biomarker shape/formatter; stop embedding error strings.**
6. Chunk KB content; make PubMed optional/cached; window chat history.

---

## 8. Proposed metadata schema (target)

> **Implementation status (2026-06-18):**
> - ✅ §8.1 columns added (`organization_id`, `report_type`, `report_date`) with
>   btree indexes; `organization_id` backfilled at ingest via subselect on
>   `uploads`. GIN indexes added on `document_chunks.metadata` and
>   `knowledge_base_chunks.metadata`.
>   Migration: `apps/api/prisma/migrations/20260617120000_document_chunks_metadata`.
> - ✅ §8.3 `risk_level` now stored on `clinical_insight` chunks (normalized from
>   `tone`); biomarker `status`/`category` stored in the summary chunk's metadata.
> - ✅ `report_type` now populated via `derive_report_type` (dominant biomarker
>   category heuristic).
> - ✅ `report_date` now populated via `parse_report_date` over the RAW
>   (pre-masking) text — collection date preferred over report date.
> - ✅ §8.2 per-biomarker rows implemented (`chunk_type="biomarker"`, one embedded
>   chunk per biomarker with `{biomarker,status,category,unit}` metadata).
> - ✅ Retrieval-time org isolation wired: `organization_id` flows
>   `chatService.ts` → `/rag/chat` → `WHERE organization_id = %s`.
> - ⏳ §8.4 chat-history vector store: still deferred (separate large feature).

A concrete target for the metadata work in §6.5. Key design rule: **fields you
filter on in `WHERE` should be real, indexed columns; sparse/optional attributes
go in JSONB**. JSONB-only filtering without a GIN index is a sequential scan.

> Reality check on what already exists in `document_chunks`:
> `patient_id`, `upload_id`, `extraction_id`, `chunk_type`, `chunk_index` are
> **already first-class columns**, and retrieval **already** does
> `WHERE patient_id = %s`. So patient-scoping is solved today — `report_id`
> maps to the existing `upload_id`/`extraction_id`. The genuinely *missing*
> high-value fields are `organization_id`, `report_date`, `report_type`, and
> (for biomarkers) `status`/`category`.

### 8.1 Report-level (per `document_chunks` row)
```json
{
  "report_id": "rep_123",          // already covered by upload_id / extraction_id
  "patient_id": "pat_456",         // ALREADY a column + WHERE filter
  "organization_id": "org_789",    // MISSING — add for multi-tenant isolation
  "report_type": "lipid_panel",    // MISSING — enables type pre-filtering
  "report_date": "2025-06-01",     // MISSING — enables recency weighting (§6.2)
  "age_group": "30-40",            // PHI — keep, but treat as PHI in logs/access
  "gender": "male"                 // PHI — same caveat
}
```
- Promote `organization_id`, `report_type`, `report_date` to **columns** with
  btree indexes (they'll be used in `WHERE`/`ORDER BY`).
- `organization_id` is the most security-relevant addition: it lets retrieval
  enforce tenant isolation (`WHERE organization_id = %s AND patient_id = %s`)
  as defense-in-depth even if a wrong `patient_id` slips through (ties into the
  auth gap in §6.1).

### 8.2 Biomarker-level (new chunk strategy)
```json
{
  "biomarker": "ldl",
  "status": "high",
  "category": "lipid",
  "unit": "mg/dL",
  "report_id": "rep_123",
  "patient_id": "pat_456"
}
```
- Today ingestion stores a **single** `biomarker_summary` chunk for the whole
  panel. To answer "show all elevated LDL reports" you need **one embedded row
  per biomarker** with `biomarker` + `status` as filterable fields.
- This is largely a **structured query**, not semantic — `status='high' AND
  biomarker='ldl'` is better served by a plain SQL filter than vector search.
  Store these as columns and you may not need the embedding at all for that case.

### 8.3 AI-summary-level (per `clinical_insight` / summary chunk)
```json
{
  "report_id": "rep_123",
  "summary_type": "overall_health",
  "risk_level": "moderate",
  "patient_id": "pat_456",
  "created_at": "2025-06-01"
}
```
- Maps onto the existing `clinical_insight` chunk_type; `risk_level` generalizes
  the currently-stored-but-unused `tone`. Add `summary_type`/`risk_level` to
  metadata and surface them in retrieval ordering.

### 8.4 Chat-history (separate store — note the current design)
```json
{
  "session_id": "sess_123",
  "patient_id": "pat_456",
  "report_id": "rep_123",
  "message_type": "user",
  "created_at": "2025-06-01T10:00:00"
}
```
- **Important**: chat history is currently persisted by the Node/Prisma side
  (`chatMessage` table) and the **full** history is passed verbatim into each
  RAG call — it is *not* vectorized or semantically retrieved today.
- Embedding chat turns would be a **new** vector store for long-term semantic
  memory (retrieve relevant past turns instead of replaying everything). That
  also fixes the unbounded-context growth in §6.6. Treat it as a separate,
  optional feature rather than part of `document_chunks`.

### 8.5 Indexing summary
| Field | Where it lives | Index |
|-------|----------------|-------|
| `patient_id`, `upload_id`, `extraction_id`, `chunk_type` | columns (exist) | btree (partial exists) |
| `organization_id`, `report_type`, `report_date` | **promote to columns** | btree |
| `biomarker`, `status`, `category` (if per-biomarker rows) | columns | btree / composite |
| `age_group`, `gender`, `risk_level`, misc | JSONB `metadata` | **GIN** |
| `embedding` | column (exists) | HNSW `vector_cosine_ops` (exists) |

---

## 9. Changelog

### 2026-06-17 — Metadata correction (focused pass; §8.1 + §8.3)

Implements the columns/indexes/richer-metadata portion of §8. Decisions:
`organization_id` populated via subselect on `uploads` (no API request-shape
changes); per-biomarker rows, chat-history vectorization, and retrieval-time org
filtering intentionally deferred.

**`apps/api/prisma/migrations/20260617120000_document_chunks_metadata/migration.sql`** (new)
- `document_chunks`: added nullable columns `organization_id`, `report_type`,
  `report_date`.
- Added FK `document_chunks_organization_id_fkey → organizations(id)`
  (`ON DELETE CASCADE`).
- Added btree indexes on `organization_id`, `report_type`, `report_date`.
- Added GIN indexes on `document_chunks.metadata` and
  `knowledge_base_chunks.metadata`.
- **Not yet applied to any database** — run `prisma migrate deploy` (or `dev`)
  against the target DB when ready.

**`app/rag/ingestion.py`**
- `INSERT` into `document_chunks` now sets `organization_id` via
  `(SELECT organization_id FROM uploads WHERE id = %s)` (NULL if absent).
- `biomarker_summary` chunk metadata now includes a per-biomarker list of
  `{name, status, category}` (new `_biomarker_metadata` helper).
- `clinical_insight` chunk metadata now includes a normalized `risk_level`
  (new `_TONE_TO_RISK` map) alongside the existing `tone`.

**`app/rag/retrieval.py`**
- Patient-chunk query now selects `metadata` and
  `COALESCE(report_date, created_at) AS chunk_date` (metadata is now read, not
  just written — resolves the §6.5 write-only issue).
- `ORDER BY` adds a recency tie-break:
  `embedding <=> q, COALESCE(report_date, created_at) DESC`.
- Context lines now carry the date: `[<chunk_type> | YYYY-MM-DD] <content>`.

**Still deferred** at the time: populate `report_type` / `report_date`;
per-biomarker chunk rows (§8.2); chat-history vector store (§8.4);
retrieval-time tenant isolation — all but §8.4 landed in the next pass below.

### 2026-06-18 — Remaining §8 pointers (no migration; code only)

Implements the rest of §8 except chat-history vectorization (§8.4, still
deferred). No schema change — the columns/indexes already existed.

**`app/rag/ingestion.py`**
- `parse_report_date(raw_text)`: best-effort regex over the RAW (pre-masking)
  text for collection/report-date labels (collection preferred), parsed via a
  fixed set of `strptime` formats; `None` when not found. The date is stored
  only in the `report_date` column — never re-embedded.
- `derive_report_type(biomarkers)`: dominant-`category` heuristic — single
  category → its slug (e.g. `lipid_panel`); ≥60% dominant → that; else
  `comprehensive_panel`; empty → `None`. Computed once per extraction.
- New `chunk_type="biomarker"` chunks: one embedded chunk per biomarker with
  metadata `{source, biomarker, status, category, unit}` (semantic retrieval +
  GIN-filterable structured queries).
- `ingest_extraction(...)` now takes `report_date`; `INSERT` writes
  `report_type` + `report_date`.

**`app/routers/extract.py`**
- Computes `report_date = parse_report_date(result["text"])` (raw text) and
  passes it into `ingest_extraction(...)`.

**`app/rag/retrieval.py`**
- `retrieve_context(..., organization_id=None)`: adds `AND organization_id = %s`
  to the patient query when supplied (KB query unchanged — it's global).
- `rag_chat(..., organization_id=None)`: threads it through.

**`app/rag/router.py`**
- `RagChatRequest.organization_id` (passed to `rag_chat`); `IngestRequest.report_date`
  (parsed via `datetime.fromisoformat`, passed to `ingest_extraction`).

**`apps/api/src/services/ragService.ts`** — `RagChatRequest.organization_id?`.

**`apps/api/src/services/chatService.ts`** — passes
`organization_id: req.principal.organizationId ?? undefined` into `ragService.chat`.

**Verification**: `py_compile` (4 files) ✓; `tsc --noEmit` (api) ✓; helper
spot-checks for `parse_report_date` (multiple formats + priority) and
`derive_report_type` (single / dominant / mixed / empty) ✓.

**Still deferred**: §8.4 chat-history vector store (new table + `/rag/chat-history`
embed endpoint + Node per-message integration + retrieval blending).

### 2026-06-18 — RAG hardening (§6.1–6.7, sequential)

Worked through the §6 weak points in order. Approach (user-confirmed):
shared-secret service auth; pool + `to_thread` offload (no full async rewrite);
full retrieval-quality pass; PubMed env-gated + cached.

**§6.1 Security**
- `app/security.py` (new): `require_service_secret` dependency — constant-time
  check of `X-Service-Secret`; 401 on mismatch, warn-once + allow when the secret
  is unset (dev). Applied in `main.py` to extract/normalize/rag routers; `/health`
  open. Node `env.ts` adds optional `EXTRACTION_SERVICE_SECRET`; `ragService.ts` +
  `extractionService.ts` send the header when set.
- `retrieval.py`: system prompts restructured — rules first, then a SECURITY
  guard, then retrieved content fenced in `BEGIN/END … (untrusted data)` blocks.

**§6.2 Retrieval quality** (`retrieval.py`, `router.py`, `seed_kb.py`)
- `RAG_MAX_DISTANCE` cutoff on patient + KB queries; over-fetch 12 →
  `_dedup_and_quota` (content dedup + `report_text` cap, structured chunks
  preserved) → top 5; `_rewrite_query` history condensation (`ENABLE_QUERY_REWRITE`);
  KB content chunked via shared `split_text` on ingest + seed.

**§6.3 Concurrency** (`llm.py`, `retrieval.py`, `ingestion.py`, `extract.py`, `router.py`)
- `psycopg_pool.ConnectionPool` (lazy singleton); `get_db_connection()` returns a
  pooled connection. Blocking DB read offloaded via `asyncio.to_thread(_query_chunks…)`;
  `aembed_query` for the query embedding; `ingest_extraction` and KB ingest run via
  `to_thread`; `embed_documents` batched (`EMBED_BATCH_SIZE=96`) + `executemany` insert.
  Added `psycopg_pool` to requirements/pyproject.

**§6.4 Reliability** (`formatting.py` new, `retrieval.py`, `ingestion.py`, `config.py`, `main.py`)
- DB-retrieval failure returns empty → neutral placeholder (never an error string
  as context); single `format_biomarker_line` (snake+camel) used by both formatters;
  PubMed gated by `ENABLE_PUBMED`, 1h TTL cache, 3s timeout, optional `NCBI_API_KEY`;
  `validate_embedding_dim()` startup guard (model→dim vs `vector(1536)`).

**§6.6 Cost** (`chatService.ts`, `retrieval.py`)
- History capped to `MAX_HISTORY_MESSAGES=12` (DB `take` + reverse); query→vector
  TTL cache (`_embed_query_cached`).

**§6.7 Observability** (`retrieval.py`)
- `RAG_DEBUG` logs candidate vs selected chunk ids/distances/types + KB count.

**New env**: Node `EXTRACTION_SERVICE_SECRET`; Python `EXTRACTION_SERVICE_SECRET`,
`RAG_MAX_DISTANCE`, `ENABLE_QUERY_REWRITE`, `ENABLE_PUBMED`, `NCBI_API_KEY`, `RAG_DEBUG`.

**Verification**: `py_compile` all touched files ✓; `tsc --noEmit` (api) ✓;
unit checks for `_dedup_and_quota`, `_rewrite_query` gating, `format_biomarker_line`
snake/camel parity, `validate_embedding_dim` (pass + raise) ✓; `pytest tests/` →
59 passed, 1 pre-existing unrelated failure (`test_compute_coverage_cbc`).

**Still deferred**: cross-encoder rerank/MMR; full async DB driver; RAG eval harness;
§8.4 chat-history vectorization.

### 2026-06-18 — Incident: `migrate dev` dropped the RAG tables

**Symptom**: `/rag/chat` failed with `relation "document_chunks" does not exist`
(both patient and doctor roles). The tables were physically gone, yet
`prisma migrate status` reported "up to date".

**Cause**: `document_chunks` / `knowledge_base_chunks` existed only as raw-SQL
migrations and were **not** modeled in `schema.prisma`. A `prisma migrate dev`
run diffed the schema (no such models) against the DB and auto-generated
`20260618025738_documents_chunks_metadata`, which `DROP TABLE`s both — then
applied it. All previously-ingested chunks were lost.

**Fix**:
- Modeled both tables as `DocumentChunk` / `KnowledgeBaseChunk` in
  `schema.prisma` (`embedding Unsupported("vector(1536)")?`, relations +
  back-relations to patients/uploads/extractions/organizations). Now Prisma
  knows about them and won't auto-drop them.
- `20260618050000_restore_rag_chunks` recreates both tables + all indexes
  (btree, HNSW `vector_cosine_ops`, GIN) + FKs; applied via `migrate deploy`.
- Re-seeded the knowledge base (`python seed_kb.py`).

**⚠️ Operational foot-gun (pgvector + Prisma)**: Prisma cannot express an HNSW
index, so `prisma migrate dev` will generate `DROP INDEX
document_chunks_embedding_idx` / `knowledge_base_chunks_embedding_idx` on every
run. This only affects the **vector indexes** (search still works, just slower),
not the tables/data. **When generating a migration, delete those `DROP INDEX`
lines** (or re-add the `CREATE INDEX ... USING hnsw (...)` afterward). The HNSW
indexes are intentionally not declared in `schema.prisma`.
