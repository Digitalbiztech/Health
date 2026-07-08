# 14 — Known Issues

## Purpose

This document catalogs all known issues, technical debt, security gaps, incomplete implementations, and development-mode workarounds across the HealthLab platform. Each issue is tagged with severity, affected service, and a recommended remediation path. This is the living "debt ledger" that should be consulted before any production deployment.

---

## Issue Severity Key

| Severity | Meaning |
| -------- | ------- |
| 🔴 **CRITICAL** | Must be resolved before production. Security vulnerability or data exposure risk. |
| 🟠 **HIGH** | Significant operational risk. Should be resolved in the next sprint. |
| 🟡 **MEDIUM** | Functional limitation or tech debt. Plan for resolution. |
| 🟢 **LOW** | Minor improvement. Address opportunistically. |

---

## Security Issues

### KI-001 — Authentication Bypass Enabled 🔴

**Severity:** CRITICAL
**Service:** API (`apps/api`)
**File:** [authGuard.ts L8](file:///home/Code/DBT/report-viewer/apps/api/src/middleware/authGuard.ts#L8)

```typescript
export const BYPASS_AUTH = true; // Set to false to restore Supabase/Passport authentication
```

**Impact:** All JWT verification is skipped. Every request is assigned a mock principal resolved from the database. Any unauthenticated client can access every endpoint including patient data, chat, and admin branding.

**Workaround in place:** Mock principals are cached per account type (`MockPrincipalCache`) to reduce DB round-trips, but this does not mitigate the security gap.

**Remediation:**
1. Set `BYPASS_AUTH = false`
2. Ensure `SUPABASE_JWT_SECRET` is configured
3. Verify Passport strategies (`supabase.strategy.ts`) resolve real JWT tokens
4. Test all protected endpoints with valid and invalid tokens

---

### KI-002 — CORS Wildcard Origin 🔴

**Severity:** CRITICAL
**Service:** API (`apps/api`)
**File:** [app.ts L34](file:///home/Code/DBT/report-viewer/apps/api/src/app.ts#L34)

```typescript
app.use(cors({ origin: "*", credentials: true }));
```

**Impact:** Any domain can make credentialed requests to the API. Combined with KI-001, this means any website can read patient health data.

**Note:** The `CORS_ORIGIN` environment variable is defined in `env.ts` (default `http://localhost:8080`) but **is not used** — the hardcoded `"*"` overrides it.

**Remediation:**
```typescript
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
```

---

### KI-003 — Supabase Storage Buckets Are Public 🔴

**Severity:** CRITICAL
**Service:** API (`apps/api`)
**File:** [supabase.storage.ts L19](file:///home/Code/DBT/report-viewer/apps/api/src/storage/supabase.storage.ts#L19)

```typescript
await supabaseAdmin.storage.createBucket(bucketName, {
    public: true, // Make public for easy access
});
```

**Impact:** Uploaded PDF lab reports and generated report PDFs are publicly accessible to anyone with the URL. These contain PHI (patient names, dates of birth, biomarker results).

**Remediation:**
1. Set `public: false` on bucket creation
2. Use signed URLs with short TTL for file access
3. Add RLS policies on Supabase Storage buckets scoped by `organizationId`

---

### KI-004 — Extraction Service Secret Optional 🟠

**Severity:** HIGH
**Service:** Extraction (`apps/extraction`)
**File:** [security.py L23-L30](file:///home/Code/DBT/report-viewer/apps/extraction/app/security.py#L23-L30)

```python
if not SERVICE_SECRET:
    if not _warned:
        logger.warning("EXTRACTION_SERVICE_SECRET is not set — service auth is DISABLED.")
        _warned = True
    return  # Allow request
```

**Impact:** When `EXTRACTION_SERVICE_SECRET` is unset (the local dev default), any client can directly call extraction endpoints (`/extract`, `/normalize`, `/rag/chat`), bypassing the API gateway's auth layer.

**Remediation:** Require the secret in production; fail-closed instead of fail-open.

---

### KI-005 — No Rate Limiting 🟠

**Severity:** HIGH
**Service:** API (`apps/api`)

**Impact:** No request rate limiting exists on any endpoint. AI chat endpoints (`POST /chat`) are particularly vulnerable — each call triggers 1-3 LLM API calls, making the platform susceptible to:
- Cost-based denial-of-service (accumulated API billing)
- Token exhaustion against OpenAI/Gemini quotas
- Database connection pool saturation

**Remediation:** Add `express-rate-limit` middleware, with stricter limits on AI endpoints:
```typescript
// Example: 30 requests/min per IP for /chat
app.use('/chat', rateLimit({ windowMs: 60_000, max: 30 }));
```

---

## Infrastructure Issues

### KI-006 — BullMQ Workers Disabled 🟠

**Severity:** HIGH
**Service:** API (`apps/api`)
**File:** [app.ts L19-L26](file:///home/Code/DBT/report-viewer/apps/api/src/app.ts#L19-L26)

```typescript
// BullMQ workers are DISABLED to avoid Redis usage.
// import './queues/report.queue.js';
// import './queues/extraction.queue.js';
// import './queues/pdf.queue.js';
```

**Impact:** Report processing runs in-process via `void (async () => { ... })()` fire-and-forget pattern in the upload controller. This means:
- No retry on extraction failure (BullMQ provided automatic retries)
- No progress tracking via job status
- No concurrency control (all uploads process simultaneously)
- Server crash during processing = lost job with no recovery
- Long-running extractions block the Node.js event loop thread pool

**Current workaround:** `runReportPipeline()` handles its own failure bookkeeping (marks upload as `FAILED`), but there is no retry mechanism.

**Remediation:**
1. Deploy Redis instance
2. Uncomment the three queue imports in `app.ts`
3. Switch `report.controller.ts` back to `enqueueReportProcessing(upload.id)`

---

### KI-007 — Background Pipeline Error Swallowing 🟡

**Severity:** MEDIUM
**Service:** API (`apps/api`)
**File:** [report.controller.ts L129-L155](file:///home/Code/DBT/report-viewer/apps/api/src/controllers/report.controller.ts#L129-L155)

```typescript
void (async () => {
    try {
        await SupabaseStorageService.uploadFile(...);
    } catch (bgErr) {
        console.error(`Background storage upload failed...`);
        await prisma.upload.update({ ..., data: { status: 'FAILED' } }).catch(() => ...);
        return;
    }
    await runReportPipeline(upload.id).catch((pipelineErr) => {
        console.error(`Pipeline processing failed...`);
    });
})();
```

**Impact:** The HTTP response (`201`) is sent before background processing begins. If the storage upload or pipeline fails:
- The client receives a success response for a job that will ultimately fail
- Errors are logged to `console.error` but not captured in a structured error tracking system
- The upload is marked `FAILED` in the database, but the client must poll to discover this

**Remediation:** Acceptable pattern if BullMQ is re-enabled (provides dead-letter queues). For in-process mode, consider structured error reporting via `AuditLog`.

---

### KI-008 — Mock PDF Generation 🟡

**Severity:** MEDIUM
**Service:** API (`apps/api`)
**File:** [reportPipeline.ts L300-L327](file:///home/Code/DBT/report-viewer/apps/api/src/services/reportPipeline.ts#L300-L327)

```typescript
// Generate mock PDF document buffer
// In production, this would call PDFKit or Puppeteer to render a premium PDF layout
const pdfContent = `
==================================================
AURIEM CLINICAL SUITE — LAB INSIGHTS REPORT
==================================================
...`;
const pdfBuffer = Buffer.from(pdfContent, 'utf-8');
```

**Impact:** The "PDF" uploaded to Supabase Storage is actually a plain-text file with a `.pdf` extension. It is not a valid PDF binary and cannot be opened in PDF viewers.

**Note:** The frontend renders reports from structured data (React components), so this does not affect the user-facing report experience. It only affects the downloadable export.

**Remediation:** Integrate a PDF rendering engine (PDFKit, Puppeteer, or `@react-pdf/renderer`) to produce valid PDF binaries from the report data.

---

## Code Quality Issues

### KI-009 — Hardcoded Biomarker Dictionary 🟡

**Severity:** MEDIUM
**Service:** Extraction (`apps/extraction`)
**File:** [dictionary.py](file:///home/Code/DBT/report-viewer/apps/extraction/app/parsers/dictionary.py) (714 lines, 29KB)

**Impact:** Adding or editing biomarkers requires a code change and service restart. No admin UI exists for dictionary management. Current dictionary covers 55 biomarkers; many regional lab panels include markers not in the dictionary (e.g., homocysteine, insulin-like growth factor, cortisol).

**Remediation:** Migrate to a database-backed registry (see `09_FEATURE_ROADMAP.md` Phase 3).

---

### KI-010 — Dead Code in Normalize Router 🟢

**Severity:** LOW
**Service:** Extraction (`apps/extraction`)
**File:** [normalize.py L43-L45](file:///home/Code/DBT/report-viewer/apps/extraction/app/routers/normalize.py#L43-L45)

```python
norm_by_input: dict[str, dict] = {}
for inp, norm in zip(raw_dicts, [None] * len(raw_dicts)):
    pass  # placeholder
```

**Impact:** This placeholder loop builds an unused `norm_by_input` dictionary. The actual per-input normalization happens in the subsequent loop (L50-L84). No functional impact, but confusing for maintainers.

**Remediation:** Delete lines 43-45.

---

### KI-011 — Organization Auto-Creation Pattern Duplication 🟡

**Severity:** MEDIUM
**Service:** API (`apps/api`)
**Files:** `report.controller.ts`, `patient.controller.ts`, `appointment.controller.ts`, `task.controller.ts`

**Impact:** The "find or create default organization + back-fill principal" pattern is duplicated across 4+ controllers with minor variations. The appointment and task controllers extract it into a `resolveStaffOrganization()` helper, but report and patient controllers inline it.

**Remediation:** Centralize into a single middleware or shared service function. Consider running it in the auth guard after principal resolution.

---

### KI-012 — No Input Validation on Several Endpoints 🟡

**Severity:** MEDIUM
**Service:** API (`apps/api`)

**Impact:** Several endpoints perform only minimal field-presence checks instead of Zod schema validation:

| Endpoint | Validation |
| -------- | ---------- |
| `POST /patients` | Manual `if (!email \|\| !firstName ...)` check |
| `POST /appointments` | Manual `if (!title \|\| !startTime ...)` check |
| `POST /tasks` | Manual `if (!title)` check |
| `PATCH /appointments/:id` | Enum validation only |
| `PATCH /tasks/:id` | Enum validation only |
| `PUT /branding/me` | No body validation — raw `req.body` passed to service |

Only `POST /auth/patient/signup` and `POST /chat` use proper Zod schema validation.

**Remediation:** Define Zod schemas for all write endpoints and validate in the controller.

---

### KI-013 — Biomarker Routes File Empty 🟢

**Severity:** LOW
**Service:** API (`apps/api`)
**File:** [biomarker.routes.ts](file:///home/Code/DBT/report-viewer/apps/api/src/routes/biomarker.routes.ts) (1 line, 0 bytes)

**Impact:** Empty file exists but is never imported or used. The biomarker controller file may also be empty or unused.

**Remediation:** Either implement biomarker-specific API endpoints or delete the empty files.

---

## Operational Issues

### KI-014 — No Structured Logging 🟡

**Severity:** MEDIUM
**Service:** Both services

**Impact:** Both services use `console.log`/`console.error` (API) and Python `logging` (extraction) with plain-text format. There is no structured JSON logging, making log aggregation, alerting, and correlation across services difficult.

**Remediation:** 
- API: Adopt `pino` or `winston` with JSON output
- Extraction: Configure Python `logging` with `json-logging` or `structlog`
- Add correlation IDs (e.g., `uploadId`) to all log entries

---

### KI-015 — No Health Check Depth 🟢

**Severity:** LOW
**Service:** API (`apps/api`)

**Impact:** The API `/health` endpoint returns a static `{ status: "ok" }` without checking database connectivity, Supabase availability, or Redis (when re-enabled). A "healthy" response doesn't guarantee the service can actually process requests.

**Remediation:** Add dependency checks:
```typescript
app.get('/health', async (req, res) => {
    const db = await prisma.$queryRaw`SELECT 1`;
    const extraction = await extractionService.health().catch(() => null);
    res.json({ status: 'ok', db: !!db, extraction: !!extraction });
});
```

---

### KI-016 — No AuditLog Dashboard 🟡

**Severity:** MEDIUM
**Service:** Frontend (`apps/web`)

**Impact:** The `AuditLog` Prisma model exists and audit entries can be created, but there is no admin UI to visualize, search, or export audit logs. This is required for HIPAA/GDPR compliance demonstrations.

**Remediation:** Build an admin-only audit log viewer with date filtering, user/patient filtering, and CSV export.

---

## Performance Issues

### KI-017 — Dual LLM Calls for Text PDFs 🟡

**Severity:** MEDIUM
**Service:** Extraction (`apps/extraction`)

**Impact:** For text-based PDFs, both PyMuPDF and pdfplumber candidates each trigger a separate LLM biomarker parsing call (`extract_biomarkers_llm()`). This doubles LLM token consumption and cost for the majority of uploads. See `13_EXTRACTION_BENCHMARKS.md` for cost profile.

**Remediation:** Consider a sequential strategy — run PyMuPDF first, evaluate quality, and only invoke pdfplumber + its LLM call if quality is below threshold.

---

### KI-018 — No Connection Pooling for Extraction Service HTTP Calls 🟢

**Severity:** LOW
**Service:** API (`apps/api`)

**Impact:** The `extractionService` creates a new `fetch` request for each extraction call. Under high upload volume, this can exhaust ephemeral ports or cause connection churn.

**Remediation:** Use an `http.Agent` with `keepAlive: true` for the extraction service client.

---

## Data Issues

### KI-019 — No Soft Delete 🟡

**Severity:** MEDIUM
**Service:** API (`apps/api`)

**Impact:** `DELETE /appointments/:id` and `DELETE /tasks/:id` perform hard deletes (`prisma.appointment.delete()`). Deleted records cannot be recovered or audited. For HIPAA compliance, all PHI-adjacent data mutations should be auditable.

**Remediation:** Add `deletedAt` timestamp fields and filter with `where: { deletedAt: null }`.

---

### KI-020 — No Pagination on List Endpoints 🟡

**Severity:** MEDIUM
**Service:** API (`apps/api`)

**Impact:** `GET /patients`, `GET /reports/uploads`, `GET /tasks`, `GET /appointments`, and `GET /chat/sessions` return all records without pagination. For organizations with hundreds of patients or thousands of uploads, this causes:
- Large response payloads
- Slow database queries (especially `/patients` which includes nested uploads + reports)
- Frontend memory pressure

**Remediation:** Add cursor-based or offset pagination with `?page=1&limit=25` query parameters.

---

## Summary Dashboard

| Severity | Count | Categories |
| -------- | ----- | ---------- |
| 🔴 CRITICAL | 3 | Auth bypass, CORS wildcard, public storage |
| 🟠 HIGH | 3 | Service secret optional, no rate limiting, BullMQ disabled |
| 🟡 MEDIUM | 10 | Mock PDF, hardcoded dictionary, no validation, no pagination, etc. |
| 🟢 LOW | 4 | Dead code, empty routes, health check, connection pooling |
| **Total** | **20** | |

### Production Readiness Blockers

Before any production deployment, these issues **must** be resolved:

1. **KI-001** — Set `BYPASS_AUTH = false` and configure Supabase JWT
2. **KI-002** — Restrict CORS to `env.CORS_ORIGIN`
3. **KI-003** — Set storage buckets to private + signed URLs
4. **KI-004** — Require `EXTRACTION_SERVICE_SECRET` in production
5. **KI-005** — Add rate limiting on AI endpoints
6. **KI-006** — Re-enable BullMQ or implement retry for in-process pipeline

---

## Related Documents

| Document | Relevance |
| -------- | --------- |
| `07_SECURITY.md` | Security architecture and production hardening plan |
| `08_DECISION_LOG.md` | Rationale behind current workarounds |
| `09_FEATURE_ROADMAP.md` | Phase 1 addresses production blockers |
| `13_EXTRACTION_BENCHMARKS.md` | KI-017 dual LLM cost analysis |

---

### Revision History

| Date       | Change |
| ---------- | ------ |
| 2026-07-08 | Initial document — 20 issues cataloged from full codebase audit. |
