# 10 — API Contracts

## Purpose

This document is the definitive reference for every HTTP endpoint across both services: the **API Service** (Node.js/Express, port 4000) and the **Extraction Service** (Python/FastAPI, port 8001). It specifies routes, methods, auth requirements, request/response shapes, status codes, and validation rules.

All API responses from the Node.js service follow the standard envelope:
```json
{
  "status": "success" | "error",
  "data": { ... },
  "message": "..." 
}
```

---

## Endpoint Index

### API Service (`/` — Express, port 4000)

| Method | Path | Auth | Account Type | Purpose |
| ------ | ---- | ---- | ------------ | ------- |
| `GET` | `/health` | None | — | API health check |
| `GET` | `/health/extraction` | None | — | Extraction service health proxy |
| `POST` | `/auth/patient/signup` | None | — | Patient self-registration |
| `GET` | `/auth/staff/me` | JWT | STAFF | Current staff principal |
| `GET` | `/auth/patient/me` | JWT | PATIENT | Current patient principal |
| `POST` | `/reports/upload` | JWT | Any | Upload PDF for processing |
| `GET` | `/reports/uploads` | JWT | Any | List uploads |
| `GET` | `/reports/upload/:uploadId` | JWT | Any | Full report by upload ID |
| `GET` | `/patients` | JWT | STAFF | List org patients |
| `GET` | `/patients/stats` | JWT | STAFF | Patient growth statistics |
| `POST` | `/patients` | JWT | STAFF | Onboard new patient |
| `POST` | `/chat` | JWT | Any | Send chat message |
| `GET` | `/chat/history` | JWT | Any | Get latest session history |
| `POST` | `/chat/session` | JWT | Any | Create new chat session |
| `GET` | `/chat/sessions` | JWT | Any | List all chat sessions |
| `GET` | `/appointments` | JWT | STAFF | List appointments |
| `POST` | `/appointments` | JWT | STAFF | Create appointment |
| `PATCH` | `/appointments/:id` | JWT | STAFF | Update appointment |
| `DELETE` | `/appointments/:id` | JWT | STAFF | Delete appointment |
| `GET` | `/tasks` | JWT | STAFF | List tasks |
| `POST` | `/tasks` | JWT | STAFF | Create task |
| `PATCH` | `/tasks/:id` | JWT | STAFF | Update task |
| `DELETE` | `/tasks/:id` | JWT | STAFF | Delete task |
| `GET` | `/branding/:slug` | None | — | Get branding by org slug |
| `GET` | `/branding/me` | JWT | Any | Get own org branding |
| `PUT` | `/branding/me` | JWT | STAFF (ADMIN) | Update own org branding |

### Extraction Service (`/` — FastAPI, port 8001)

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `GET` | `/health` | None | Service health check |
| `POST` | `/extract` | X-Service-Secret | Extract + parse PDF |
| `POST` | `/normalize` | X-Service-Secret | Normalize biomarker batch |
| `POST` | `/normalize/resolve` | X-Service-Secret | Name-only resolution |
| `POST` | `/rag/chat` | X-Service-Secret | RAG-grounded chat |
| `POST` | `/rag/ingest` | X-Service-Secret | Manual chunk ingestion |
| `POST` | `/rag/knowledge-base/ingest` | X-Service-Secret | Add KB guideline |
| `GET` | `/rag/health` | None | RAG subsystem health |

---

## API Service Endpoints

### Health

#### `GET /health`

No authentication required.

**Response** `200`:
```json
{ "status": "ok", "timestamp": "2026-07-03T05:00:00.000Z" }
```

#### `GET /health/extraction`

Proxies the extraction service health check.

**Response** `200`:
```json
{
  "status": "ok",
  "extraction": {
    "status": "healthy",
    "service": "extraction",
    "biomarkers_loaded": 60,
    "presidio_available": true,
    "openai_available": true,
    "openai_model": "gpt-4o-mini"
  }
}
```

**Response** `502 / 503`:
```json
{ "status": "unavailable", "error": "..." }
```

---

### Auth

#### `POST /auth/patient/signup`

Public. Creates a Supabase Auth user and a Prisma Patient record.

**Validation** (Zod `patientSignupSchema`):

| Field | Type | Rules |
| ----- | ---- | ----- |
| `email` | string | Valid email |
| `password` | string | Min 6 chars |
| `firstName` | string | Min 1 char |
| `lastName` | string | Min 1 char |
| `dateOfBirth` | string | Parseable date |
| `gender` | enum | `MALE`, `FEMALE`, `OTHER` |

**Response** `201`:
```json
{
  "status": "success",
  "data": {
    "patient": {
      "id": "uuid", "email": "...", "firstName": "...", "lastName": "...",
      "dateOfBirth": "1990-01-01T00:00:00.000Z", "gender": "MALE"
    },
    "session": {
      "access_token": "jwt...", "refresh_token": "...",
      "expires_in": 3600, "token_type": "bearer"
    }
  }
}
```

#### `GET /auth/staff/me`

Returns the authenticated staff principal.

**Response** `200`:
```json
{
  "status": "success",
  "data": {
    "id": "uuid", "email": "...", "firstName": "...", "lastName": "...",
    "role": "ADMIN", "accountType": "STAFF", "organizationId": "uuid"
  }
}
```

#### `GET /auth/patient/me`

Returns the authenticated patient principal.

**Response** `200`:
```json
{
  "status": "success",
  "data": {
    "id": "uuid", "email": "...", "firstName": "...", "lastName": "...",
    "dateOfBirth": "1990-01-01T00:00:00.000Z", "gender": "MALE",
    "accountType": "PATIENT", "organizationId": "uuid"
  }
}
```

---

### Reports

#### `POST /reports/upload`

Multipart form upload. Accepts a single PDF file (`field: file`).

| Field | Source | Required | Notes |
| ----- | ------ | -------- | ----- |
| `file` | multipart | Yes | PDF only, max 20MB |
| `patientId` | body | Staff only | Required when staff uploads on behalf of a patient |

**Behavior:**
1. Validates PDF MIME type
2. Computes deterministic Supabase Storage path
3. Creates `Upload` record (status: `PENDING`)
4. Responds `201` immediately
5. Background: uploads to Supabase Storage → runs `runReportPipeline()`

**Response** `201`:
```json
{
  "status": "success",
  "message": "Report uploaded successfully and enqueued for processing",
  "data": {
    "upload": {
      "id": "uuid", "fileName": "report.pdf", "fileUrl": "https://...",
      "fileType": "PDF", "fileSize": 123456, "status": "PENDING",
      "patientId": "uuid", "organizationId": "uuid",
      "createdAt": "...", "updatedAt": "..."
    }
  }
}
```

#### `GET /reports/uploads`

Lists uploads scoped by principal:
- **PATIENT** → own uploads only
- **STAFF** → all uploads in their organization

**Response** `200`:
```json
{
  "status": "success",
  "data": { "uploads": [ /* Upload[] */ ] }
}
```

#### `GET /reports/upload/:uploadId`

Returns the full report payload including extraction, biomarkers, and generated report.

**Caching:** Returns `ETag` header. Supports `If-None-Match` conditional requests → `304 Not Modified`.

**Security:** Patients can only view their own uploads (403 if `patientId` doesn't match).

**Response** `200`:
```json
{
  "status": "success",
  "data": {
    "upload": {
      "id": "uuid", "status": "COMPLETED",
      "extraction": {
        "id": "uuid", "status": "COMPLETED", "source": "pymupdf",
        "confidence": 0.92, "rawData": { ... },
        "biomarkers": [
          {
            "id": "uuid", "canonicalName": "hemoglobin", "displayName": "Hemoglobin",
            "value": "14.2000", "unit": "g/dL", "referenceRange": "12.0 - 17.5 g/dL",
            "referenceMin": "12.0000", "referenceMax": "17.5000",
            "status": "NORMAL", "category": "CBC"
          }
        ]
      },
      "reports": [
        {
          "id": "uuid", "title": "Clinical Lab Insights — John Doe",
          "summary": "...", "status": "GENERATED", "pdfUrl": "https://...",
          "insights": [ ... ]
        }
      ],
      "patient": { "id": "uuid", "firstName": "John", "lastName": "Doe", ... }
    }
  }
}
```

---

### Patients

#### `GET /patients`

Staff-only. Returns all patients in the organization with their uploads and latest report.

**Response** `200`:
```json
{
  "status": "success",
  "data": {
    "patients": [
      {
        "id": "uuid", "email": "...", "firstName": "...", "lastName": "...",
        "dateOfBirth": "...", "gender": "MALE", "organizationId": "uuid",
        "uploads": [
          { "id": "uuid", "status": "COMPLETED", "reports": [{ ... }] }
        ]
      }
    ]
  }
}
```

#### `POST /patients`

Staff-only. Onboards a new patient: creates Supabase Auth user + Prisma Patient record.

**Body:**

| Field | Type | Required |
| ----- | ---- | -------- |
| `email` | string | Yes |
| `firstName` | string | Yes |
| `lastName` | string | Yes |
| `dateOfBirth` | string (ISO) | Yes |
| `gender` | string | Yes |
| `note` | string | No |

**Response** `201`:
```json
{
  "status": "success",
  "data": { "patient": { /* Patient record */ } }
}
```

**Error** `409`: Patient with this email already exists.

#### `GET /patients/stats`

Staff-only. Returns cumulative patient counts per month, split by gender.

**Response** `200`:
```json
{
  "status": "success",
  "data": {
    "stats": [
      { "month": "Jan 2026", "male": 5, "female": 8, "other": 1, "total": 14 }
    ]
  }
}
```

---

### Chat

#### `POST /chat`

Generates a clinical-assistant reply. Tries RAG first, then falls back through the provider chain.

**Validation** (Zod `chatBodySchema`):

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `messages` | `{role, content}[]` | Yes | Min 1, last must be `user` |
| `biomarkers` | `{displayName, value, unit?, referenceRange?, status}[]` | No | Active session biomarkers |
| `patient` | `{firstName?, lastName?, gender?, dateOfBirth?}` | No | Patient context for prompt |
| `patientId` | string | No | Explicit patient (for staff) |
| `sessionId` | string | No | Resume specific session |

**Response** `200`:
```json
{
  "status": "success",
  "data": {
    "reply": "Your hemoglobin level of 14.2 g/dL is within the normal...",
    "provider": "rag-openai",
    "sessionId": "uuid"
  }
}
```

#### `GET /chat/history?patientId=uuid`

Returns the latest chat session and its messages for a patient.
- **PATIENT** → `patientId` auto-resolved from principal
- **STAFF** → must provide `patientId` query param

**Response** `200`:
```json
{
  "status": "success",
  "data": {
    "session": { "id": "uuid", "title": "...", "createdAt": "..." },
    "messages": [
      { "id": "uuid", "role": "user", "content": "...", "createdAt": "..." },
      { "id": "uuid", "role": "assistant", "content": "...", "createdAt": "..." }
    ]
  }
}
```

#### `POST /chat/session`

Creates a new empty chat session for a patient.

**Body:** `{ "patientId": "uuid" }` (staff only; patients auto-resolve)

**Response** `200`:
```json
{ "status": "success", "data": { "sessionId": "uuid" } }
```

#### `GET /chat/sessions?patientId=uuid`

Lists all chat sessions for a patient, ordered by most recent.

**Response** `200`:
```json
{
  "status": "success",
  "data": [
    { "id": "uuid", "title": "Iron level discussion", "createdAt": "..." }
  ]
}
```

---

### Appointments

All appointment endpoints require `STAFF` account type.

#### `GET /appointments?from=ISO&to=ISO`

Lists appointments in the organization. Optional `from`/`to` query params filter by `startTime`.

**Response** `200`:
```json
{
  "status": "success",
  "data": {
    "appointments": [
      {
        "id": "uuid", "title": "Follow-up Lab Review",
        "notes": "...", "startTime": "...", "endTime": "...",
        "status": "SCHEDULED",
        "patient": { "id": "uuid", "firstName": "...", "lastName": "...", "gender": "..." },
        "user": { "id": "uuid", "firstName": "...", "lastName": "..." }
      }
    ]
  }
}
```

#### `POST /appointments`

| Field | Type | Required |
| ----- | ---- | -------- |
| `title` | string | Yes |
| `startTime` | string (ISO) | Yes |
| `patientId` | string (UUID) | Yes |
| `endTime` | string (ISO) | No |
| `notes` | string | No |

**Response** `201`

#### `PATCH /appointments/:id`

All fields optional: `title`, `notes`, `startTime`, `endTime`, `status`.

**Status values:** `SCHEDULED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`

**Response** `200`

#### `DELETE /appointments/:id`

**Response** `200`: `{ "status": "success", "data": { "id": "uuid" } }`

---

### Tasks

All task endpoints require `STAFF` account type.

#### `GET /tasks`

Lists tasks ordered by status (open first), then due date, then creation date.

**Response** `200`:
```json
{
  "status": "success",
  "data": {
    "tasks": [
      {
        "id": "uuid", "title": "Review CBC results",
        "description": "...", "status": "TODO",
        "priority": "HIGH", "dueDate": "...",
        "patient": { "id": "uuid", "firstName": "...", "lastName": "..." }
      }
    ]
  }
}
```

#### `POST /tasks`

| Field | Type | Required |
| ----- | ---- | -------- |
| `title` | string | Yes |
| `description` | string | No |
| `priority` | enum | No (`LOW`, `MEDIUM`, `HIGH`) |
| `dueDate` | string (ISO) | No |
| `patientId` | string (UUID) | No |

**Response** `201`

#### `PATCH /tasks/:id`

All fields optional: `title`, `description`, `status`, `priority`, `dueDate`.

**Status values:** `TODO`, `IN_PROGRESS`, `DONE`

**Response** `200`

#### `DELETE /tasks/:id`

**Response** `200`: `{ "status": "success", "data": { "id": "uuid" } }`

---

### Branding

#### `GET /branding/:slug`

Public. Resolves branding config by organization slug. Used by the frontend to theme the UI before authentication.

**Response** `200`:
```json
{
  "status": "success",
  "data": {
    "brandName": "Health Dashboard",
    "tagline": "AI-Powered Clinical Insights",
    "primaryColor": "25 31% 75%",
    "secondaryColor": "210 40% 45%",
    "logoMainUrl": "/logo/main.png",
    "logoIconUrl": "/logo/icon.png",
    "showPoweredBy": true,
    "poweredByText": "POWERED BY HUUMANIZE"
  }
}
```

#### `GET /branding/me`

Returns branding for the authenticated principal's organization.

#### `PUT /branding/me`

STAFF + ADMIN only. Updates the organization's branding configuration.

**Body:** Partial `OrganizationBranding` fields (any subset).

---

## Extraction Service Endpoints

### `GET /health`

**Response** `200`:
```json
{
  "status": "healthy",
  "service": "extraction",
  "biomarkers_loaded": 60,
  "presidio_available": true,
  "openai_available": true,
  "openai_model": "gpt-4o-mini"
}
```

### `POST /extract`

Full PDF extraction pipeline. See `04_EXTRACTION_PIPELINE.md` for stage-by-stage detail.

**Request:**
```json
{
  "file_url": "https://...supabase.co/storage/v1/object/public/uploads/...",
  "file_type": "application/pdf",
  "upload_id": "uuid",
  "patient_id": "uuid"
}
```

**Response** `200`:
```json
{
  "success": true,
  "upload_id": "uuid",
  "data": {
    "text": "raw extracted text...",
    "masked_text": "[PERSON_a1b2c3d4] visited...",
    "method": "pymupdf",
    "confidence": 0.92,
    "page_count": 3,
    "pages": [{"page": 1, "text": "..."}],
    "masked_pages": [{"page": 1, "text": "..."}],
    "phi_entities_count": 12,
    "phi_entities": [
      {"entity_type": "PERSON", "start": 0, "end": 8, "text": "John Doe",
       "score": 0.95, "source": "presidio", "token": "[PERSON_a1b2c3d4]", "page": 1}
    ],
    "metadata": {},
    "parsed_biomarkers": [{"name": "hemoglobin", "value": "14.2", "unit": "g/dL"}],
    "normalized_biomarkers": [
      {"canonical_name": "hemoglobin", "display_name": "Hemoglobin",
       "value": "14.2000", "unit": "g/dL", "reference_range": "12.0 - 17.5 g/dL",
       "status": "NORMAL", "category": "CBC", "confidence": 1.0,
       "match_method": "exact", "source": "pymupdf"}
    ],
    "insights": [{"id": "i-abc123", "title": "...", "body": "...", "tone": "positive"}],
    "quality": {
      "extractor": "pymupdf", "confidence_score": 0.92,
      "coverage_score": 0.95, "structural_score": 0.88,
      "critical_marker_score": 1.0,
      "detected_panels": ["CBC", "Lipid Panel"],
      "missing_critical": []
    }
  }
}
```

**Error response:**
```json
{ "success": false, "upload_id": "uuid", "error": "All extraction methods failed" }
```

### `POST /normalize`

Standalone biomarker normalization (no PDF required).

**Request:**
```json
{
  "inputs": [
    {"name": "FBS", "value": "105", "unit": "mg/dL"},
    {"name": "Hb", "value": "14.2", "unit": "g/dL"}
  ],
  "min_confidence": 0.5
}
```

**Response** `200`:
```json
{
  "results": [
    {
      "input": "FBS", "canonical_name": "glucose_fasting",
      "display_name": "Fasting Blood Sugar", "confidence": 0.90,
      "match_method": "abbreviation", "value": "105.0000", "unit": "mg/dL",
      "status": "HIGH", "reference_range": "70 - 99 mg/dL",
      "category": "Diabetes", "reference_min": 70.0, "reference_max": 99.0
    },
    {
      "input": "Unknown Marker", "canonical_name": null,
      "confidence": 0.0, "match_method": "none"
    }
  ],
  "matched": 1,
  "unmatched": 1
}
```

### `POST /normalize/resolve`

Name-only resolution — no value processing, unit conversion, or status classification.

**Request:**
```json
{ "names": ["FBS", "hemoglobin", "SGPT", "unknown_marker"] }
```

**Response** `200`:
```json
{
  "results": [
    {"input": "FBS", "canonical_name": "glucose_fasting", "display_name": "Fasting Blood Sugar",
     "confidence": 0.90, "match_method": "abbreviation"},
    {"input": "hemoglobin", "canonical_name": "hemoglobin", "display_name": "Hemoglobin",
     "confidence": 1.0, "match_method": "exact"},
    {"input": "SGPT", "canonical_name": "alt", "display_name": "ALT (SGPT)",
     "confidence": 0.88, "match_method": "abbreviation"},
    {"input": "unknown_marker", "canonical_name": null, "display_name": null,
     "confidence": 0.0, "match_method": "none"}
  ]
}
```

### `POST /rag/chat`

See `06_RAG_ARCHITECTURE.md` for retrieval details.

**Request:**
```json
{
  "patient_id": "uuid",
  "messages": [{"role": "user", "content": "What is my hemoglobin?"}],
  "user_input": "What is my hemoglobin?",
  "biomarkers": [{"displayName": "Hemoglobin", "value": 14.2, "unit": "g/dL",
                   "referenceRange": "12.0 - 17.5", "status": "NORMAL"}],
  "user_role": "patient",
  "organization_id": "uuid"
}
```

**Response** `200`:
```json
{ "reply": "Your hemoglobin is 14.2 g/dL, within normal range...", "provider": "openai" }
```

### `POST /rag/ingest`

Manual chunk ingestion for a patient's extraction.

**Request:**
```json
{
  "patient_id": "uuid", "upload_id": "uuid",
  "extraction_id": null,
  "masked_text": "masked report text...",
  "biomarkers": [{ ... }], "insights": [{ ... }],
  "report_date": "2024-01-15T00:00:00"
}
```

**Response** `200`:
```json
{ "success": true, "chunks_created": 18 }
```

### `POST /rag/knowledge-base/ingest`

Adds clinical guideline content to the global knowledge base.

**Request:**
```json
{
  "topic": "Vitamin D Deficiency",
  "content": "Vitamin D is essential for calcium absorption...",
  "metadata": {"biomarker": "VITAMIN_D", "category": "vitamins"}
}
```

**Response** `200`:
```json
{ "success": true, "chunks_created": 2, "chunk_id": "uuid" }
```

### `GET /rag/health`

**Response** `200`:
```json
{ "status": "online", "database": "healthy", "provider": "openai" }
```

---

## Error Codes

### API Service

| Code | Meaning | Example Trigger |
| ---- | ------- | --------------- |
| `400` | Bad Request | Missing required field, invalid file type, Zod validation failure |
| `401` | Unauthorized | Missing/invalid JWT, wrong account type |
| `403` | Forbidden | Patient accessing another patient's report, non-admin updating branding |
| `404` | Not Found | Upload, patient, appointment, or task not found |
| `409` | Conflict | Duplicate patient email |
| `500` | Internal Server Error | Unhandled exception (generic message in production) |

### Extraction Service

| Code | Meaning | Example Trigger |
| ---- | ------- | --------------- |
| `400` | Bad Request | Unsupported file type |
| `401` | Unauthorized | Missing/invalid X-Service-Secret |
| `422` | Validation Error | Pydantic schema mismatch |
| `500` | Internal Error | LLM failure, database error |

---

## Authentication Headers

| Service | Header | Format | Required |
| ------- | ------ | ------ | -------- |
| API | `Authorization` | `Bearer <JWT>` | All protected routes |
| Extraction | `X-Service-Secret` | Plain string | All protected routes (skipped in dev) |

---

## Related Documents

| Document | Relevance |
| -------- | --------- |
| `04_EXTRACTION_PIPELINE.md` | Full `/extract` pipeline detail |
| `05_AI_PIPELINE.md` | Chat provider chain and prompt design |
| `06_RAG_ARCHITECTURE.md` | `/rag/chat` retrieval internals |
| `07_SECURITY.md` | Auth, CORS, rate limiting |

---

### Revision History

| Date       | Change |
| ---------- | ------ |
| 2026-07-03 | Initial document — 34 endpoints documented from route/controller audit. |
