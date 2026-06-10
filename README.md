# Report Viewer

A full-stack medical lab report processing platform. Patients and clinicians upload lab PDFs, which are extracted, PHI-masked, normalized into canonical biomarkers, scored, and turned into AI-assisted clinical reports — with trend analysis, comparison, and a RAG-grounded chat assistant.

## Architecture

A monorepo (pnpm + Turborepo) with three deployable services:

| Service | Path | Stack |
|---------|------|-------|
| **Web** (frontend) | `apps/web` | React 19, Vite, TypeScript, Tailwind, TanStack Query |
| **API** (backend) | `apps/api` | Node/Express, TypeScript, Prisma + PostgreSQL, BullMQ + Redis |
| **Extraction** (backend) | `apps/extraction` | Python 3.12, FastAPI, OpenAI, LangChain, pgvector |

Shared packages live in `packages/` (`shared`, `phi-masks`). Auth and storage are backed by Supabase; async processing runs on Redis-backed queues.

**Processing pipeline:** `Upload → report-queue → extraction-queue (calls Python service) → pdf-queue → Report + PDF export`

---

## Frontend Features (`apps/web`)

### Authentication & Routing
- Unified login/signup page with account-type toggle (**Clinician/Staff** vs **Patient**).
- Patient self-signup with DOB and gender; password visibility toggle.
- Supabase-backed sessions with a dev **mock bypass** mode.
- `AuthContext` resolves the principal via dual-endpoint fallback (`/auth/staff/me` ↔ `/auth/patient/me`) and persists the preferred account type in localStorage.
- `ProtectedRoute` guards all non-login routes with a loading state and redirect.
- Role-based UI: the dashboard conditionally renders the clinician or patient experience.

### Clinician Dashboard
- **Directory tab:** searchable patient list with inline View / Onboard / Edit actions.
- **Activity tab:** recent org uploads, appointments, and tasks.
- **Onboard patient modal:** register a new patient (email, name, DOB, gender, note) with verification-link generation.
- **Patient case file** with sub-tabs:
  - **Reports** — uploaded reports with status badges and view/delete.
  - **Trends** — biomarker trends across the patient's history.
  - **Compare** — side-by-side delta table of two reports.
  - **Insights** — AI clinical recommendations from the latest report.
- **Upload management** for the selected patient with polling (1.5s) until extraction completes.
- **Appointments sidebar:** view appointments with status (Scheduled / Completed / Cancelled / No-show) and inline status updates; create via modal.
- **Task sidebar:** create / toggle / delete tasks, filter open vs done, color-coded priority (High / Medium / Low).

### Patient Home
- Profile card (name, email, DOB, age, gender).
- Health stats (total / completed / pending uploads; normal vs flagged biomarkers).
- **Health snapshot** card with a 0–100 health score and AI summary points.
- AI insights summary of key recommendations.
- Lab report history with status badges and quick actions (View PDF, Review Analysis).
- **First-visit guided tour** (Driver.js, 7 steps) highlighting key sections; tracked in localStorage and resettable.

### Report Dashboard
- **Current Report:** clinical overview (demographics, lab metadata, test date, health score, flagged summary) plus an interactive biomarker grid with reference-range sliders, search/filter by panel, and a flagged-only toggle.
- **Biomarker detail dialog:** rich clinical descriptions (what it is, why it matters, actionable tips).
- **Trends tab:** Recharts line chart across historical reports with reference-range shading.
- **AI Chat tab:** multi-turn assistant with biomarker + patient context, session management, markdown rendering, and collapsible scientific references.
- **Compare tab:** delta table classifying changes as improved / worsened / stable / new / resolved with drag-and-drop upload slots for Report A/B.

### Visualization, Export & Theming
- Recharts-based trend lines, reference-area shading, and status-colored biomarker sliders/badges.
- **PDF export** via `@react-pdf/renderer` (`PremiumPDFDocument`): branded, font-embedded report with gauge charts, trends, and recommendations.
- **CSV export** of the biomarker matrix.
- **Theming:** light / dark / system modes (`ThemeContext` + `ThemeToggle`) with OS preference detection and CSS custom properties.
- Toast notifications (sonner), drag-and-drop uploads, responsive Tailwind layouts.

### Frontend Tech
React 19, React Router 7, TanStack Query, Supabase JS, Tailwind 4, lucide-react, recharts, `@react-pdf/renderer` + jspdf + html2canvas, react-markdown + remark-gfm, driver.js, Vite.

---

## Backend Features — API Service (`apps/api`)

### REST Endpoints

**Auth** (`/auth`)
- `POST /auth/patient/signup` — public patient signup (creates Supabase user + Patient record, returns token).
- `GET /auth/staff/me` — current clinician profile.
- `GET /auth/patient/me` — current patient profile.

**Patients** (`/patients`, STAFF only)
- `GET /patients` — list org patients with latest upload/report data.
- `POST /patients` — onboard a patient (Supabase user + temp password).
- `GET /patients/stats` — cumulative signups bucketed by month + gender.

**Reports** (`/reports`)
- `POST /reports/upload` — multipart PDF upload (max 20MB), stored to Supabase, enqueues pipeline.
- `GET /reports/uploads` — list uploads (patient-scoped or org-scoped).
- `GET /reports/upload/:uploadId` — full report data (extraction, biomarkers, report).

**Chat** (`/chat`)
- `POST /chat` — clinical assistant reply grounded in biomarkers + patient context (RAG with LLM fallback).
- `GET /chat/history` — latest session + messages.
- `POST /chat/session` — create a session.
- `GET /chat/sessions` — list sessions (staff sees any patient; patient sees own).

**Appointments** (`/appointments`, STAFF only)
- `GET` (with `?from`/`?to` filter), `POST`, `PATCH /:id`, `DELETE /:id`.

**Tasks** (`/tasks`, STAFF only)
- `GET` (sorted by status/priority/due), `POST`, `PATCH /:id`, `DELETE /:id`.

**Health**
- `GET /health`, `GET /health/extraction`.

### Auth & Authorization
- Passport JWT strategy validating Supabase bearer tokens, plus a dev mock-bypass mode.
- Two account types — **STAFF** (roles USER/ADMIN/DOCTOR) and **PATIENT** — in separate tables.
- Guards: `requireAuth`, `requireAccountType(...)`, `requireRole(...)`.
- Multi-tenant scoping: all data bound by `organizationId`.

### Background Jobs (BullMQ + Redis)
- **report-queue** — transitions upload PENDING → PROCESSING, enqueues extraction (concurrency 5, 3 retries w/ backoff).
- **extraction-queue** — calls the Python extraction service, persists Extraction + Biomarker records, enqueues PDF generation; marks FAILED on error.
- **pdf-queue** — builds insights, generates a clinical narrative summary (OpenAI), creates the Report, renders the PDF, uploads to Supabase, records a ReportExport.

### AI / LLM Integrations
- **Google Gemini** (`gemini-1.5-flash`), **OpenAI** (`gpt-4o-mini`), **Mistral** (`mistral-medium-latest`).
- Chat strategy: try the Python RAG service first, then fall back through Gemini → OpenAI → Mistral.
- Distinct **patient** (plain-language) and **doctor** (clinical/peer) system prompts with biomarker + demographic context and full message history.
- OpenAI generates the PDF report's clinical narrative summary.

### PDF, Storage & Other
- Server-side PDF generation in the pdf-queue (text renderer; Puppeteer available); content includes demographics, biomarkers with ranges/flags, recommendations, and disclaimer.
- Supabase Storage buckets `uploads/` and `reports/` (auto-created, 20MB limit, delete support).
- PHI: detection/masking handled at the extraction service; middleware stub present.
- Security/infra: helmet, CORS, morgan request logging, zod DTO validation.

### API Tech
Express 4, Prisma 7 + PostgreSQL, Passport + passport-jwt, jsonwebtoken, Supabase JS, BullMQ + ioredis, `@google/generative-ai`, openai, Mistral (REST), multer, puppeteer, zod, vitest.

### Database Models (Prisma)
`Organization` (tenant), `User` (staff), `Patient`, `Upload`, `Extraction` (1:1 upload), `Biomarker` (many per extraction), `Report` (versioned, latest flag), `ReportExport`, `ChatSession`, `ChatMessage`, `Appointment`, `Task`, `Notification`, `AuditLog`. Both staff and patients act as polymorphic actors; all entities scoped by organization.

---

## Backend Features — Extraction Service (`apps/extraction`)

### FastAPI Endpoints
- `POST /extract` — full pipeline: download PDF → text extraction → PHI masking → LLM biomarker parsing → normalization → insights. Auto-ingests into RAG if `patient_id` provided.
- `POST /normalize` — standalone biomarker normalization (names/values/units → canonical, with confidence).
- `POST /normalize/resolve` — name-only canonical resolution.
- `GET /health` — dictionary load count, Presidio/OpenAI availability, active model.
- `POST /rag/chat` — RAG clinical chat (patient/doctor modes) grounded in patient history + KB + current panel.
- `POST /rag/ingest` — embed & store extraction components into pgvector.
- `POST /rag/knowledge-base/ingest` — ingest clinical guidelines / reference material.
- `GET /rag/health` — DB + embedding-provider status.

### PDF Extraction (cascading, quality-driven)
- **PyMuPDF** — primary native text extraction (fast, conf 0.95).
- **pdfplumber** — layout/table fallback (conf 0.88).
- **Mistral OCR** (`mistral-ocr-latest`) — scanned/image fallback (conf 0.75).
- Classifier routes image PDFs straight to OCR; text PDFs run PyMuPDF + pdfplumber in parallel, then the biomarker sets are compared and the higher-quality result chosen, escalating to OCR on large discrepancy.

### Biomarker Parsing Pipeline
- **LLM extraction** — OpenAI structured outputs pull `{name, value, unit, reference_min/max}` tuples from masked text.
- **Dictionary** — 50+ canonical biomarkers with aliases, preferred units, conversions, reference ranges, critical thresholds, and panel categories (Diabetes, Lipid, Kidney, Liver, Electrolytes, Thyroid, Iron, Vitamins, Inflammation, …).
- **Normalizer** — 5-strategy cascade (exact alias → affix strip → abbreviation → token-set → fuzzy Levenshtein) with unit conversion and LOW/NORMAL/HIGH/CRITICAL status classification.
- **Fuzzy** — pure-Python Levenshtein + token-set matching (no native deps).
- **Quality** — composite score (0.45 coverage + 0.30 structural + 0.25 critical) that flags weak extractions for OCR escalation.
- **Insights** — OpenAI structured outputs generate 2–4 observational insights (positive/watch/neutral tone).

### PHI Detection & Masking
- **Presidio** (spaCy `en_core_web_sm`) detects PERSON, PHONE, EMAIL, DATE_TIME, LOCATION, SSN, license/passport/credit-card, IP, medical license, etc., with a 40+ medical-term whitelist and numeric-value skipping.
- **Regex fallback** — 12 medical patterns (MRN, patient ID, DOB, SSN, Aadhaar, phone IN/US, email, age, address, doctor/patient name) run in parallel and merged (Presidio preferred on overlap).
- **Token vault** — deterministic, bidirectional, cross-page-consistent tokenization (`[ENTITY_<hash>]`). Masking happens before any LLM call.

### RAG
- Embeddings: OpenAI `text-embedding-3-small` (1536-dim); vector store: Supabase PostgreSQL + pgvector (`document_chunks`).
- Ingestion splits masked report text (500-char chunks / 100 overlap), embeds report text + biomarker summary + insights, idempotent per upload.
- Retrieval: cosine similarity over patient history + knowledge base, merged into dual-mode (patient/doctor) system prompts. LangChain chat model at temp 0.3.
- Graceful degradation throughout — all LLM/RAG features are optional.

### Extraction Tech
Python ≥3.12, FastAPI + Uvicorn + Pydantic v2, PyMuPDF, pdfplumber, httpx, Presidio (analyzer/anonymizer) + spaCy, OpenAI SDK, LangChain (+ openai/postgres/text-splitters), psycopg 3, pgvector, Supabase.

---

## Getting Started

See `DEPLOYMENT_GUIDE.md` for full setup. In brief: copy `.env.example` to `.env`, then `docker-compose up` (or run `setup.sh`) to start Postgres, Redis, the API, the extraction service, and the web app. Prisma migrations live in `apps/api/prisma/migrations`.
