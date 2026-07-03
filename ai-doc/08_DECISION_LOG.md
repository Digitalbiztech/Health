# 08 — Decision Log

## Purpose

This document records the significant architectural and engineering decisions made during the development of the HealthLab platform. Each entry captures the context that motivated the decision, the alternatives considered, the chosen approach, and the trade-offs accepted. Entries are numbered for cross-referencing from other documents.

Decisions are grouped by domain and ordered by impact, not chronologically.

---

## Index

| # | Decision | Domain | Impact |
| - | -------- | ------ | ------ |
| D-001 | Separate User and Patient tables | Data Model | High |
| D-002 | Parallel-then-best extraction strategy | Extraction | High |
| D-003 | PHI masking before all LLM calls | Security | Critical |
| D-004 | Decimal(10,4) for biomarker values | Data Model | High |
| D-005 | Inline pipeline over BullMQ workers | Architecture | High |
| D-006 | Multi-provider chat fallback chain | AI | High |
| D-007 | Per-biomarker RAG chunks | RAG | Medium |
| D-008 | RAG tables modeled in Prisma | Data Model | High |
| D-009 | Report versioning via isLatest flag | Data Model | Medium |
| D-010 | Unified ProcessingStatus enum | Data Model | Low |
| D-011 | HSL strings for branding colors | Multi-tenancy | Medium |
| D-012 | Weighted coverage in quality scoring | Extraction | Medium |
| D-013 | 5-strategy name resolution cascade | Normalization | High |
| D-014 | CORS wildcard in development | Security | Medium |
| D-015 | BYPASS_AUTH constant for dev mode | Security | Medium |
| D-016 | Polymorphic FK pairs for actors | Data Model | Medium |
| D-017 | OpenAI Structured Outputs for parsing | AI | High |
| D-018 | Shared TokenVault across pages | PHI | Medium |
| D-019 | Global knowledge base (not tenant-scoped) | RAG | Low |
| D-020 | report_text chunk cap in retrieval | RAG | Medium |

---

## Decisions

### D-001 — Separate User and Patient Tables

**Date:** 2026-05-28 (initial schema)
**Status:** Accepted
**Domain:** Data Model

**Context:**
The platform serves two fundamentally different principal types: clinical staff (doctors, admins) and patients. A common pattern is single-table inheritance with a `type` discriminator column.

**Alternatives considered:**

| Option | Pros | Cons |
| ------ | ---- | ---- |
| Single `actors` table with `type` column | Single FK on shared entities, simpler joins | Sparse columns (`role` irrelevant to patients, `dateOfBirth`/`gender` irrelevant to staff), mixed auth flows in one table, query confusion |
| Separate `users` + `patients` tables | Clean field sets, independent auth flows, distinct query patterns, type-safe principal types | Requires polymorphic FK pairs on shared entities (AuditLog, Notification, ChatSession, ReportExport) |

**Decision:** Separate tables. Staff and patients have fundamentally different field sets, different auth flows (Supabase metadata lookup path differs), different query patterns (staff query all patients; patients query only their own data), and different relationship cardinalities.

**Trade-off:** Nullable FK pairs (`userId?` + `patientId?`) on 4 shared entities with app-layer enforcement of exactly-one-non-null. No database constraint enforces this — a bug could leave both null or both set.

**References:** [schema.prisma](file:///home/Code/DBT/report-viewer/apps/api/prisma/schema.prisma#L13-L80), `03_DATABASE_SCHEMA.md`

---

### D-002 — Parallel-Then-Best Extraction Strategy

**Date:** 2026-06-08
**Status:** Accepted
**Domain:** Extraction Pipeline

**Context:**
Medical PDFs vary wildly in structure — some are well-formed text, others use complex table layouts, others are scanned images. A single extractor can't reliably handle all cases.

**Alternatives considered:**

| Option | Pros | Cons |
| ------ | ---- | ---- |
| Sequential cascade (try A, if bad try B) | Simpler logic, fewer LLM calls | Latency proportional to number of fallbacks, can't compare quality between extractors |
| Parallel all extractors, pick best | Best quality, direct comparison | OCR is slow + expensive, wasted calls |
| **Parallel text extractors, conditional OCR** | Fast for text PDFs (both CPU-local), quality comparison, OCR only when needed | Each text extractor independently runs PHI masking + LLM parsing (2× LLM calls for text PDFs) |

**Decision:** Run PyMuPDF and pdfplumber in parallel, compare their biomarker sets, and escalate to Mistral OCR only when there's a significant discrepancy (>2 markers or >20% of union differ) or both produce low confidence.

**Trade-off:** The LLM parsing call is made twice for text PDFs. This is acceptable because: (a) both text extractors run in sub-second time, (b) the LLM calls overlap in wall-clock time, and (c) the comparison step catches cases where one extractor silently misses table data that the other captures.

**References:** [extractors/\_\_init\_\_.py](file:///home/Code/DBT/report-viewer/apps/extraction/app/extractors/__init__.py), `04_EXTRACTION_PIPELINE.md`

---

### D-003 — PHI Masking Before All LLM Calls

**Date:** 2026-06-08
**Status:** Accepted — **Non-negotiable**
**Domain:** Security / Compliance

**Context:**
Medical lab reports contain Protected Health Information (PHI): patient names, dates of birth, MRNs, addresses. Sending this to external LLM APIs would violate HIPAA-adjacent privacy requirements.

**Decision:** The `_process_candidate()` function always calls `mask_text()` and `mask_pages()` before `extract_biomarkers_llm()`. This ordering is enforced by code structure, not configuration. The masked text uses deterministic tokens (`[PERSON_a1b2c3]`) so the LLM can still understand entity relationships without seeing real values.

**Alternatives rejected:**
- Relying on LLM provider data processing agreements (DPAs) alone — insufficient for defense-in-depth
- Masking at the API layer before sending to the extraction service — would require the Node.js service to have a PHI detector, duplicating logic

**Trade-off:** None significant. The masking step adds ~50ms and is justified by the compliance requirement.

**References:** [phi/tokenizer.py](file:///home/Code/DBT/report-viewer/apps/extraction/app/phi/tokenizer.py), `07_SECURITY.md`

---

### D-004 — Decimal(10,4) for Biomarker Values

**Date:** 2026-05-28
**Status:** Accepted
**Domain:** Data Model

**Context:**
Biomarker values like `5.0` vs `4.9999` can change a status classification from NORMAL to LOW. IEEE 754 floating-point arithmetic produces rounding errors (e.g., `0.1 + 0.2 = 0.30000000000000004`).

**Decision:** All biomarker numeric columns (`value`, `referenceMin`, `referenceMax`) use `Decimal(10,4)` in Prisma, mapped to PostgreSQL's `NUMERIC(10,4)`. The API handles these as `Prisma.Decimal` objects, not native JavaScript numbers.

**Alternatives rejected:**
- `Float` — accumulates rounding errors across operations
- `String` — loses queryability (can't do `WHERE value > 5.0`)
- `Integer` (value × 10000) — fragile scaling, confusing for developers

**Trade-off:** Slightly more complex value handling in TypeScript (must use `new Prisma.Decimal(value)` rather than bare numbers). Acceptable for medical accuracy.

**References:** [schema.prisma L226](file:///home/Code/DBT/report-viewer/apps/api/prisma/schema.prisma#L221-L247), `03_DATABASE_SCHEMA.md`

---

### D-005 — Inline Pipeline Over BullMQ Workers

**Date:** 2026-06-01
**Status:** Accepted (temporary)
**Domain:** Architecture

**Context:**
The report processing pipeline (upload → extraction → PDF generation) was initially designed with BullMQ workers backed by Redis. The queue infrastructure is fully implemented in `queues/*.queue.ts`.

**Decision:** Disable BullMQ and run the pipeline in-process via `runReportPipeline()`. The queue imports are commented out in `app.ts`.

**Reason:** Eliminates the Redis dependency for local development and simplifies debugging (single process, synchronous stack traces). The extraction service call is the bottleneck (~5-30s for OCR), so the queue's concurrency benefits are minimal for current scale.

**Alternatives:**
- Keep BullMQ enabled — requires running Redis locally, adds operational complexity
- Use a simpler in-memory queue — no persistence benefit, same complexity

**Reversal criteria:** Re-enable BullMQ when: (a) production scale demands concurrent processing, (b) the pipeline needs retry/backoff logic for transient LLM API failures, or (c) the platform moves to a multi-instance deployment where uploads must be distributed.

**Trade-off:** No retry semantics, no concurrency control, no job persistence. A server crash during pipeline processing loses the job (upload stays PROCESSING forever). Acceptable for development; must be addressed for production.

**References:** [app.ts L19-L26](file:///home/Code/DBT/report-viewer/apps/api/src/app.ts#L19-L26), [reportPipeline.ts](file:///home/Code/DBT/report-viewer/apps/api/src/services/reportPipeline.ts), `01_ARCHITECTURE.md`

---

### D-006 — Multi-Provider Chat Fallback Chain

**Date:** 2026-06-08
**Status:** Accepted
**Domain:** AI

**Context:**
LLM APIs have unpredictable availability — rate limits, outages, quota exhaustion. A single-provider design creates a single point of failure for the chat feature.

**Decision:** Implement a cascading fallback: RAG (OpenAI via Python) → Gemini → OpenAI (direct) → Mistral. Each provider implements a `ChatProvider` interface. `ProviderError` carries typed codes (`QUOTA_EXCEEDED`, `SERVICE_UNAVAILABLE`, `NOT_CONFIGURED`) that the orchestrator uses to decide whether to retry or fall through.

**Alternatives rejected:**
- Single provider with retries — doesn't help with quota exhaustion
- Random provider selection — inconsistent quality, harder to debug
- User-selectable provider — unnecessary complexity for end users

**Trade-off:** The RAG path (Python service) uses a different OpenAI model instance than the direct OpenAI fallback (Node.js), so response style may vary slightly between providers. The dual-mode system prompt (patient/doctor) mitigates this.

**References:** [chatService.ts](file:///home/Code/DBT/report-viewer/apps/api/src/services/chatService.ts), [ai/types.ts](file:///home/Code/DBT/report-viewer/apps/ai/types.ts), `05_AI_PIPELINE.md`

---

### D-007 — Per-Biomarker RAG Chunks

**Date:** 2026-06-17
**Status:** Accepted
**Domain:** RAG

**Context:**
Initially, biomarkers were embedded only as a single summary chunk per extraction. When a user asked "what is my iron level?", the summary chunk (containing 15+ markers) would score lower than an ideal single-marker chunk.

**Decision:** Embed each biomarker as its own chunk in addition to the panel summary. Each individual chunk carries structured metadata (`biomarker`, `status`, `category`, `unit`) for GIN-indexed filtering.

**Trade-off:** Increases chunk count per extraction by N (where N = number of biomarkers). A typical extraction with 15 markers now produces ~20 chunks instead of ~5. This increases embedding API cost proportionally but improves retrieval precision significantly.

**References:** [ingestion.py L194-L213](file:///home/Code/DBT/report-viewer/apps/extraction/app/rag/ingestion.py#L194-L213), `06_RAG_ARCHITECTURE.md`

---

### D-008 — RAG Tables Modeled in Prisma

**Date:** 2026-06-18
**Status:** Accepted (learned from incident)
**Domain:** Data Model

**Context:**
The `document_chunks` and `knowledge_base_chunks` tables were originally created via raw SQL migrations only (not modeled in `schema.prisma`). On 2026-06-18, a `prisma migrate dev` run auto-generated a migration that dropped both tables because Prisma treated them as "drift."

**Decision:** Model both tables in `schema.prisma` using `Unsupported("vector(1536)")` for the embedding column. HNSW indexes are still created via raw SQL in migrations (Prisma can't generate them), but the tables themselves are now tracked.

**Trade-off:** The `embedding` column is typed as `Unsupported(...)`, which means the Prisma client can't read/write it. This is acceptable because the Python service uses raw SQL (`psycopg`) for all vector operations — Prisma never touches the embedding column.

**Incident:** Migration `20260618025738` caused data loss. Existing embeddings were unrecoverable. `20260618050000_restore` recreated the tables.

**References:** [schema.prisma L504-L545](file:///home/Code/DBT/report-viewer/apps/api/prisma/schema.prisma#L504-L545), `03_DATABASE_SCHEMA.md`

---

### D-009 — Report Versioning via isLatest Flag

**Date:** 2026-05-28
**Status:** Accepted
**Domain:** Data Model

**Context:**
Reports need to be re-generated (e.g., after re-extraction or template changes) without losing the audit trail of previous versions.

**Decision:** Allow multiple `Report` rows per `Upload`, with a `version` counter and `isLatest` boolean. A compound index `(uploadId, isLatest)` efficiently resolves the latest version.

**Alternatives rejected:**
- Overwrite in place — loses audit history
- Soft delete previous versions — complicates queries (must filter `deletedAt IS NULL`)
- Separate `report_versions` table — over-normalized for current needs

**Trade-off:** App-layer logic must set `isLatest = false` on old versions when generating a new one. No database constraint enforces single-latest — a bug could create two `isLatest = true` rows per upload.

**References:** [schema.prisma L249-L301](file:///home/Code/DBT/report-viewer/apps/api/prisma/schema.prisma#L249-L301)

---

### D-010 — Unified ProcessingStatus Enum

**Date:** 2026-05-28
**Status:** Accepted
**Domain:** Data Model

**Context:**
The original schema had separate `UploadStatus` and `ExtractionStatus` enums with identical values (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`).

**Decision:** Merge into a single `ProcessingStatus` enum used by both `Upload` and `Extraction` models.

**Trade-off:** Minimal — the enums were already identical. If Upload and Extraction ever need divergent statuses, the enum would need to be split again.

---

### D-011 — HSL Strings for Branding Colors

**Date:** 2026-06-22
**Status:** Accepted
**Domain:** Multi-tenancy

**Context:**
The frontend uses CSS custom properties for theming (`--color-primary: hsl(25, 31%, 75%)`). The database needs to store color values that can be injected directly into CSS.

**Decision:** Store HSL values as plain strings without the `hsl()` wrapper (e.g., `"25 31% 75%"`). The frontend wraps them: `hsl(var(--color-primary))`.

**Alternatives rejected:**
- Hex strings — can't leverage HSL-based lightness calculations for derived tones
- JSON objects `{h, s, l}` — requires parsing on every render
- CSS color names — too limited

**Trade-off:** Storing HSL without the wrapper is non-obvious. Developers must know the convention. The schema comments document this.

**References:** [schema.prisma L109-L155](file:///home/Code/DBT/report-viewer/apps/api/prisma/schema.prisma#L109-L155)

---

### D-012 — Weighted Coverage in Quality Scoring

**Date:** 2026-06-08
**Status:** Accepted
**Domain:** Extraction Pipeline

**Context:**
Most real-world lab reports include only a subset of a panel's possible markers. A basic CBC may include hemoglobin, WBC, RBC, platelets but omit MCV, MCH, MCHC, RDW. Without weighting, a complete extraction of 4 core markers would score only 50% coverage (4/8 expected), triggering unnecessary OCR escalation.

**Decision:** Weight critical markers at 1.0 and optional markers at 0.4 in the coverage calculation: `coverage = weighted_found / weighted_expected`.

**Trade-off:** Requires maintaining a per-panel list of critical vs optional markers. Currently defined for 10 panels — must be extended as the biomarker dictionary grows.

**References:** [quality.py](file:///home/Code/DBT/report-viewer/apps/extraction/app/parsers/quality.py), `02_SYSTEM_DESIGN.md`

---

### D-013 — 5-Strategy Name Resolution Cascade

**Date:** 2026-06-08
**Status:** Accepted
**Domain:** Normalization

**Context:**
LLM-extracted biomarker names vary wildly: "Fasting Blood Sugar Level", "FBS", "glucose fasting", "Blood Glucose - Fasting". A single matching strategy can't handle all variants.

**Decision:** Apply 5 strategies in decreasing confidence order:
1. Exact alias index lookup (conf 1.00)
2. Suffix/prefix strip + retry (conf 0.95)
3. Abbreviation index (conf 0.88–0.90)
4. Token-set similarity ≥ 0.65 (conf ≤ 0.85)
5. Levenshtein fuzzy ≥ 0.75 (conf ≤ 0.80)

**Alternatives rejected:**
- LLM-based name resolution — too slow and expensive for every biomarker in every extraction
- Embedding similarity — requires pre-computed embeddings for all aliases, overkill for a bounded dictionary

**Trade-off:** Fuzzy matching (strategies 4-5) can produce false positives. The confidence score is attached to every resolved biomarker so downstream consumers can filter low-confidence matches.

**References:** [normalizer.py](file:///home/Code/DBT/report-viewer/apps/extraction/app/parsers/normalizer.py), `02_SYSTEM_DESIGN.md`

---

### D-014 — CORS Wildcard in Development

**Date:** 2026-05-28
**Status:** Accepted (temporary)
**Domain:** Security

**Context:**
During development, the frontend may run on various ports (Vite dev server, Docker, etc.). Restrictive CORS blocks development velocity.

**Decision:** Set `cors({ origin: "*" })` in development. The `CORS_ORIGIN` environment variable is defined in `env.ts` but not yet wired into the CORS middleware.

**Reversal criteria:** Before production deployment, change to `cors({ origin: env.CORS_ORIGIN })`.

**References:** [app.ts L34](file:///home/Code/DBT/report-viewer/apps/api/src/app.ts#L34), `07_SECURITY.md` (Gap #2)

---

### D-015 — BYPASS_AUTH Constant for Dev Mode

**Date:** 2026-05-28
**Status:** Accepted (temporary)
**Domain:** Security

**Context:**
Full Supabase Auth requires a running Supabase instance with properly configured JWT secrets. This slows down local development and makes it harder for new contributors to get started.

**Decision:** A compile-time `BYPASS_AUTH = true` constant in `authGuard.ts` skips JWT verification and creates mock principals. The mock principal is cached per account type to avoid repeated DB lookups.

**Reversal criteria:** Set to `false` before production deployment. Consider using an environment variable instead of a compile-time constant for more flexibility.

**References:** [authGuard.ts L8](file:///home/Code/DBT/report-viewer/apps/api/src/middleware/authGuard.ts#L8), `07_SECURITY.md` (Gap #1)

---

### D-016 — Polymorphic FK Pairs for Actors

**Date:** 2026-05-28
**Status:** Accepted
**Domain:** Data Model

**Context:**
Several entities need to record "who performed the action" — which could be either a staff user or a patient.

**Decision:** Use dual nullable FK columns (`actorUserId` / `actorPatientId`) with application-layer enforcement that exactly one is non-null.

**Alternatives rejected:**
- Single `actors` table with type discriminator — see D-001
- Generic polymorphic columns (`actor_type` + `actor_id` strings) — loses referential integrity, can't cascade deletes

**Affected entities:** AuditLog, Notification, ReportExport, ChatSession

**Trade-off:** No database-level constraint enforces the exactly-one-non-null invariant. A CHECK constraint could be added: `CHECK ((actor_user_id IS NULL) != (actor_patient_id IS NULL))`.

---

### D-017 — OpenAI Structured Outputs for Biomarker Parsing

**Date:** 2026-06-08
**Status:** Accepted
**Domain:** AI

**Context:**
The biomarker parser needs to extract structured `{name, value, unit, reference_min, reference_max}` records from free-form text. Plain text output requires fragile regex/JSON parsing of the LLM response.

**Decision:** Use OpenAI's `response_format: { type: "json_schema", json_schema: ... }` with `strict: true`. The schema constrains the model to output only valid biomarker records.

**Alternatives rejected:**
- Free-text output + regex parsing — fragile, breaks on format changes
- Function calling — similar capability but more complex setup
- Fine-tuned model — expensive, requires training data

**Trade-off:** Requires OpenAI (other providers don't support Structured Outputs). The extraction pipeline is already OpenAI-dependent for embeddings, so this doesn't add a new vendor dependency.

**References:** [biomarker.py L44-L69](file:///home/Code/DBT/report-viewer/apps/extraction/app/parsers/biomarker.py#L44-L69)

---

### D-018 — Shared TokenVault Across Pages

**Date:** 2026-06-08
**Status:** Accepted
**Domain:** PHI

**Context:**
A patient's name may appear on multiple pages of a PDF. If each page generated independent mask tokens, the same name would get different tokens on different pages, confusing downstream analysis.

**Decision:** Pass a single `TokenVault` instance through `mask_pages()`, which iterates all pages with the same vault. The vault uses SHA-256 hashing of `entity_type:text` to produce deterministic tokens.

**Trade-off:** The vault grows linearly with the number of unique PHI entities. For typical lab reports (5-20 entities), this is negligible. A report with thousands of unique PHI values could consume significant memory — but this is unrealistic for lab reports.

**References:** [tokenizer.py](file:///home/Code/DBT/report-viewer/apps/extraction/app/phi/tokenizer.py)

---

### D-019 — Global Knowledge Base (Not Tenant-Scoped)

**Date:** 2026-06-17
**Status:** Accepted
**Domain:** RAG

**Context:**
Knowledge base chunks contain clinical guidelines (e.g., "Fasting Blood Glucose Guidelines"). These are evidence-based medical facts, not tenant-specific data.

**Decision:** KB chunks are stored without an `organization_id` and are retrieved globally for all tenants.

**Alternatives considered:**
- Tenant-scoped KB — allows custom guidelines per organization, but duplicates content and complicates seeding
- Both global + tenant-scoped — added complexity for a feature that isn't yet requested

**Reversal criteria:** If organizations need custom clinical guidelines (e.g., different reference ranges per population), add an optional `organization_id` column to `knowledge_base_chunks` and filter at retrieval time.

**References:** [retrieval.py L180-L190](file:///home/Code/DBT/report-viewer/apps/extraction/app/rag/retrieval.py#L180-L190)

---

### D-020 — Report Text Chunk Cap in Retrieval

**Date:** 2026-06-17
**Status:** Accepted
**Domain:** RAG

**Context:**
Long PDF reports produce many `report_text` chunks that all score similarly in cosine search. Without a cap, 5/5 patient context slots could be filled with near-duplicate text chunks, leaving no room for the more semantically useful `biomarker` and `clinical_insight` chunks.

**Decision:** Cap `report_text` chunks at 3 per retrieval (`REPORT_TEXT_CAP = 3`), with backfill from capped chunks only if under the final limit.

**Trade-off:** A query that genuinely needs more full-text context (e.g., "summarize the entire report") will have truncated coverage. The current cap is a heuristic — may need tuning with production query patterns.

**References:** [retrieval.py L26-L68](file:///home/Code/DBT/report-viewer/apps/extraction/app/rag/retrieval.py#L26-L68), `06_RAG_ARCHITECTURE.md`

---

## Pending Decisions

| Topic | Context | Blocked By |
| ----- | ------- | ---------- |
| Database-backed biomarker dictionary | Currently a flat Python module (29KB). Admin-editable registry would enable dynamic expansion. | Product requirements for dictionary management UI |
| Streaming chat responses | Full response returned after generation. SSE/WebSocket streaming would reduce perceived latency. | Frontend streaming UI implementation |
| BullMQ re-enablement | Queue infrastructure is complete but disabled. Production scale will require background workers. | Production deployment timeline |
| Mutual TLS for service-to-service | Current shared-secret approach has no rotation mechanism. | Infrastructure / DevOps capacity |
| HL7/FHIR output adapters | Planned for interoperability. | Regulatory requirements clarification |

---

## Related Documents

| Document | Relevance |
| -------- | --------- |
| `00_PROJECT_OVERVIEW.md` | Strategic context for decisions |
| `01_ARCHITECTURE.md` | Implementation of architectural decisions |
| `02_SYSTEM_DESIGN.md` | Implementation of design decisions |
| `07_SECURITY.md` | Production checklist tied to security decisions |

---

### Revision History

| Date       | Change |
| ---------- | ------ |
| 2026-07-03 | Initial document — 20 decisions cataloged from full codebase audit. |
