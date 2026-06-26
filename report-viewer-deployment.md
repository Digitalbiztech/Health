# Report Viewer — Deployment Approaches
 
Two deployment paths for the Report Viewer platform. Approach A gets you live quickly at low cost. Approach B is the production-grade path for real clinical customers with HIPAA/GDPR requirements.
 
---
 
## Supabase Replacement (Approach B only)
 
Supabase stays untouched in Approach A — no migration needed there. For Approach B (full HIPAA/GDPR compliance), Supabase has no BAA on its free or Pro plans, so it is split into three purpose-built replacements:
 
| Supabase role | Replacement (Approach B only) | Notes |
|---|---|---|
| Auth (JWT, sessions, user mgmt) | **Clerk** | BAA on Enterprise plan; drop-in for your `AuthContext` dual-fallback pattern |
| File Storage (uploads/, reports/) | **AWS S3** (SSE-KMS) | Presigned URLs replace Supabase Storage URLs; minimal code change in upload endpoints |
| pgvector (RAG embeddings) | **Neon** (serverless Postgres + pgvector) | Fully managed, pgvector built-in, BAA on Business plan ($19/mo) |
 
> Clerk replaces your `POST /auth/patient/signup`, `GET /auth/staff/me`, and `GET /auth/patient/me` endpoints with its own SDK calls. Your Passport JWT strategy swaps to validating Clerk-issued JWTs — a one-line change in the strategy config.
 
---
 
## Approach A — Non-Compliant (Fast & Cheap)
 
For internal demos, pilots with non-clinical data, or markets where HIPAA/GDPR do not apply. **Do not use with real patient PHI.**
 
> **Supabase stays as-is in Approach A.** Auth, Storage, and pgvector all remain on Supabase — no migration needed. Supabase replacement only applies in Approach B.
 
### Option A1 — VPS (Recommended start)
 
Single-server Docker Compose deployment. Easiest migration from your current Render/Vercel setup. **Keep your existing `.env` and Supabase config — nothing changes there.**
 
**Provider:** Hetzner Cloud (best price/performance ratio)
 
| Server | Spec | Monthly cost | Runs |
|---|---|---|---|
| `cx41` (primary) | 4 vCPU / 16 GB RAM | ~€18 | Node API + BullMQ workers + FastAPI extraction + Caddy (reverse proxy) |
| `cx21` (database) | 2 vCPU / 4 GB RAM | ~€6 | PostgreSQL (with pgvector) + Redis |
| Hetzner Object Storage | S3-compatible bucket | ~€5 | PDF uploads + report exports (optional — Supabase Storage also works) |
 
**Total: ~€24–29/mo (~$26–32)**
 
#### Architecture
 
```
Internet
  │
  ▼
Caddy (reverse proxy, auto HTTPS)       ← cx41
  ├── :443  → apps/web  (Vite static, served by Caddy)
  ├── /api/*    → Node API  (Express :3000)
  └── /extract/*→ FastAPI   (:8000, uvicorn)
 
BullMQ workers                          ← cx41 (same Node process as API)
  └── report-queue / extraction-queue / pdf-queue
 
PostgreSQL 16 + pgvector extension      ← cx21
Redis 7                                 ← cx21
 
Supabase                                ← unchanged (Auth + pgvector RAG)
External LLM APIs                       ← OpenAI / Gemini / Mistral (unchanged)
```
 
Caddy handles SSL automatically — point your domain A record to the cx41 IP and it provisions Let's Encrypt certs on first request. No nginx config, no Certbot. This is the closest equivalent to your current Render + Vercel setup, just self-hosted.
 
#### Key differences from current setup
 
- **Vercel → Caddy** serving the static Vite build from cx41
- **Render (Node API) → Docker container** on cx41, managed by Docker Compose `restart: unless-stopped`
- **FastAPI cloud → Docker container** on cx41, same Compose stack, memory limit set to 6GB for spaCy/Presidio headroom
- **Supabase Postgres → self-hosted PostgreSQL** on cx21 (or keep Supabase DB if preferred — both work)
- **Redis** moves from Render add-on to self-hosted on cx21
---
 
### Option A2 — AWS (Non-Compliant)
 
Use when you want AWS ecosystem tooling but aren't ready for full compliance overhead. Services are split across two EC2 instances to keep costs low — a small instance for the Node API and a medium instance for the memory-hungry Python extraction service (spaCy + Presidio need ~2GB RAM at startup alone).
 
| Resource | Spec | Monthly est. |
|---|---|---|
| EC2 — Node API + BullMQ | `t3.small` (2 vCPU / 2GB RAM) | ~$15 |
| EC2 — FastAPI extraction | `t3.medium` (2 vCPU / 4GB RAM) | ~$30 |
| RDS PostgreSQL + pgvector | `db.t3.micro` | ~$15 |
| ElastiCache Redis | `cache.t3.micro` | ~$12 |
| S3 (uploads + reports) | Standard storage | ~$3 |
| CloudFront + S3 | Frontend static hosting | ~$2 |
| Route 53 | DNS | ~$1 |
| **External APIs** | | |
| Supabase | Auth + pgvector (free tier) | $0–25 |
| OpenAI | Embeddings + LLM (usage-based) | ~$20–50 |
| Mistral API | OCR | ~$0–10 |
 
**Total: $78 + $20-85 = ~$98–153/mo** (infra + APIs at moderate usage)
 
Put both EC2s, RDS, and ElastiCache in a **VPC with private subnets** — RDS and ElastiCache must never be publicly accessible, only reachable from the EC2 instances via security group rules. The two EC2s communicate internally over the VPC private network.
 
---

## Approach B — Full HIPAA + GDPR Compliance

For real clinical customers. Every architectural decision is driven by compliance requirements.

### Vendor matrix — BAA/DPA status

| Service | Role | BAA available | Action |
|---|---|---|---|
| **AWS** | Infra (EC2, RDS, S3, ElastiCache) | ✓ Free (AWS Artifact) | Sign before go-live |
| **Clerk** | Auth | ✓ Enterprise plan | Required before real patient data |
| **Neon** | pgvector / Prisma DB | ✓ Business plan ($19/mo) | Required |
| **AWS Bedrock**| All LLM calls | ✓ (same as AWS BAA) | replaces OpanAI+Gemini chain 
| **OpenAI** | LLM + embeddings | ✓ Enterprise only | Upgrade or replace |
| **Google Vertex AI** | Gemini fallback | ✓ | Switch from `@google/generative-ai` to Vertex AI SDK |
| **AWS Textract** | OCR fallback (replaces Mistral OCR) | ✓ | Mistral has no BAA |
| **Mistral** | Chat fallback | ✗ No BAA | Remove from fallback chain entirely |

> **Mistral must be removed from any pipeline touching real patient text.** Replace `mistral-medium-latest` chat fallback with a second OpenAI call or an Azure OpenAI deployment. Replace `mistral-ocr-latest` with AWS Textract (Read API), which is HIPAA-eligible and returns structured text from scanned PDFs.

### Infrastructure — AWS (eu-west-1 for EU patients)

All resources must be provisioned in the **same compliant AWS region.** For EU patient data: `eu-west-1` (Ireland) or `eu-central-1` (Frankfurt).

```
┌─────────────────────────────────────────────────────────┐
│  VPC  (10.0.0.0/16)                                     │
│                                                         │
│  ┌──────────────────┐    ┌──────────────────────────┐   │
│  │  Public subnet   │    │    Private subnet         │   │
│  │                  │    │                           │   │
│  │  ALB (HTTPS)     │    │  EC2: Node API (t3.small) │   │
│  │  NAT Gateway     │    │  EC2: Extraction (t3.med) │   │
│  └──────────────────┘    │  RDS: PostgreSQL          │   │
│                          │  ElastiCache: Redis        │   │
│                          └──────────────────────────┘   │
└─────────────────────────────────────────────────────────┘

CloudFront → S3 (frontend static)
Route 53 → ALB (API) + CloudFront (web)
ACM → TLS certs (auto-renewing)
```

| Resource | Spec | Monthly est. |
|---|---|---|
| EC2 Node API | `t3.small` + EBS gp3 encrypted | ~$15 |
| EC2 Extraction | `t3.medium` + EBS gp3 encrypted | ~$30 |
| RDS PostgreSQL | `db.t3.small`, Multi-AZ, encrypted | ~$50 |
| ElastiCache Redis | `cache.t3.micro`, encrypted at rest | ~$12 |
| S3 (uploads + exports) | SSE-KMS encryption, versioning on | ~$5 |
| CloudFront + ACM | CDN + free TLS | ~$3 |
| ALB | Application Load Balancer | ~$16 |
| NAT Gateway | Outbound traffic for private subnet | ~$32 |
| CloudTrail + CloudWatch | Audit logging + monitoring | ~$10 |
| Neon Business | pgvector, BAA | $19 |
| Clerk Enterprise | Auth, BAA | ~$50 |

**Total: ~$242/mo**

### Encryption requirements

**At rest:**
```bash
# RDS — enable on creation (cannot be added after)
aws rds create-db-instance \
  --storage-encrypted \
  --kms-key-id alias/reportviewer-rds

# S3 — bucket policy enforcing SSE-KMS
aws s3api put-bucket-encryption \
  --bucket reportviewer-uploads \
  --server-side-encryption-configuration '{
    "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "aws:kms"}}]
  }'

# ElastiCache — at-rest + in-transit encryption
aws elasticache create-replication-group \
  --at-rest-encryption-enabled \
  --transit-encryption-enabled
```

**In transit:**
- TLS 1.2+ on all external endpoints (ALB handles this)
- Internal service-to-service (API → Extraction) must also use HTTPS even inside VPC
- Your `X-Service-Secret` header is good — add it to internal HTTPS calls:

```typescript
// apps/api/src/services/extraction.ts
const response = await fetch('https://extraction.internal/extract', {
  headers: {
    'X-Service-Secret': process.env.SERVICE_SECRET!,
    'Content-Type': 'application/json',
  },
});
```

### Mistral replacement

**OCR fallback — replace `mistral-ocr-latest` with  AWS Textract:**

```python
# apps/extraction/src/extractors/ocr_extractor.py
import boto3

textract = boto3.client('textract', region_name='eu-west-1')

def extract_with_textract(s3_bucket: str, s3_key: str) -> str:
    response = textract.detect_document_text(
        Document={'S3Object': {'Bucket': s3_bucket, 'Name': s3_key}}
    )
    blocks = response['Blocks']
    lines = [b['Text'] for b in blocks if b['BlockType'] == 'LINE']
    return '\n'.join(lines)
```
### How to rewrite your fallback chain using Bedrock

Your current chain is: FastAPI RAG → Gemini → OpenAI → Mistral. All three of those external providers have compliance problems or no BAA. With Bedrock, the entire chain collapses into one compliant service:

```typescript
// apps/api/src/services/chat.ts
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrock = new BedrockRuntimeClient({ region: 'eu-west-1' }); // GDPR: stay in EU region

const FALLBACK_MODELS = [
  'anthropic.claude-sonnet-4-6',      // primary — best clinical reasoning
  'meta.llama3-3-70b-instruct-v1:0',  // fallback — cheap, solid
  'amazon.nova-pro-v1:0',             // final fallback — AWS-native, very cheap
];

async function invokeBedrockModel(modelId: string, prompt: string, systemPrompt: string) {
  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31', // for Claude models
    max_tokens: 1000,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  });

  const command = new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body,
  });

  const response = await bedrock.send(command);
  return JSON.parse(new TextDecoder().decode(response.body));
}

export async function chatWithFallback(prompt: string, systemPrompt: string) {
  // Try RAG service first
  try {
    return await tryRAGService(prompt, systemPrompt);
  } catch {}

  // Bedrock fallback chain — all under one BAA
  for (const modelId of FALLBACK_MODELS) {
    try {
      return await invokeBedrockModel(modelId, prompt, systemPrompt);
    } catch (err) {
      console.warn(`Bedrock model ${modelId} failed, trying next`);
    }
  }
  throw new Error('All LLM providers exhausted');
}
```
For the Python extraction service, replace your OpenAI SDK calls too:

```python
# apps/extraction/src/llm/bedrock_client.py
import boto3, json

bedrock = boto3.client('bedrock-runtime', region_name='eu-west-1')

def invoke_claude(prompt: str, system: str) -> str:
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 2000,
        "system": system,
        "messages": [{"role": "user", "content": prompt}]
    })
    response = bedrock.invoke_model(
        modelId="anthropic.claude-sonnet-4-6",
        contentType="application/json",
        accept="application/json",
        body=body
    )
    result = json.loads(response['body'].read())
    return result['content'][0]['text']
```
This replaces your openai.chat.completions.create() calls in the biomarker parsing pipeline and insight generation.

---
### Gemini — switch to Vertex AI

```typescript
// Before (non-compliant)
import { GoogleGenerativeAI } from '@google/generative-ai';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// After (HIPAA-eligible via Vertex AI)
import { VertexAI } from '@google-cloud/vertexai';
const vertexAI = new VertexAI({ project: process.env.GCP_PROJECT_ID!, location: 'us-central1' });
const model = vertexAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
```

### Audit log — surface as UI (mandatory for HIPAA)

Your `AuditLog` Prisma model exists. Wire it up:

```typescript
// apps/api/src/middleware/audit.ts
export const auditLog = (action: string) => async (req: Request, res: Response, next: NextFunction) => {
  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action,
      resourceType: req.baseUrl.split('/')[1],
      resourceId: req.params.id ?? null,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      organizationId: req.user.organizationId,
      timestamp: new Date(),
    }
  });
  next();
};

// Apply to all patient data routes
router.get('/patients/:id', auditLog('PATIENT_VIEW'), getPatient);
router.get('/reports/upload/:uploadId', auditLog('REPORT_VIEW'), getReport);
```

Expose `GET /audit-logs` (ADMIN role only) with date filtering, CSV export, and 6-year retention policy on the records.

### Session timeout (HIPAA §164.312(a)(2)(iii))

```typescript
// apps/web/src/context/AuthContext.tsx
const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

useEffect(() => {
  const timer = setTimeout(() => {
    supabase.auth.signOut(); // or clerk.signOut()
    navigate('/login?reason=timeout');
  }, SESSION_TIMEOUT_MS);

  const reset = () => { clearTimeout(timer); /* restart */ };
  window.addEventListener('mousemove', reset);
  window.addEventListener('keydown', reset);
  return () => { clearTimeout(timer); window.removeEventListener('mousemove', reset); };
}, []);
```

### GDPR — right to erasure pipeline

```typescript
// apps/api/src/services/patient-erasure.ts
export async function erasePatient(patientId: string, organizationId: string) {
  // 1. Delete pgvector embeddings
  await supabaseVectorClient.from('document_chunks')
    .delete().eq('patient_id', patientId);

  // 2. Delete S3 files
  const uploads = await prisma.upload.findMany({ where: { patientId } });
  await Promise.all(uploads.map(u => s3.deleteObject({ Bucket: 'uploads', Key: u.storageKey })));

  // 3. Cascade delete in order (FK constraints)
  await prisma.$transaction([
    prisma.chatMessage.deleteMany({ where: { session: { patientId } } }),
    prisma.chatSession.deleteMany({ where: { patientId } }),
    prisma.biomarker.deleteMany({ where: { extraction: { upload: { patientId } } } }),
    prisma.extraction.deleteMany({ where: { upload: { patientId } } }),
    prisma.reportExport.deleteMany({ where: { report: { upload: { patientId } } } }),
    prisma.report.deleteMany({ where: { upload: { patientId } } }),
    prisma.upload.deleteMany({ where: { patientId } }),
    prisma.appointment.deleteMany({ where: { patientId } }),
    prisma.notification.deleteMany({ where: { patientId } }),
    // AuditLog: strip PII fields but retain record (legal exception)
    prisma.auditLog.updateMany({
      where: { resourceId: patientId },
      data: { userId: '[ERASED]', ipAddress: null }
    }),
    prisma.patient.delete({ where: { id: patientId } }),
  ]);
}
```

### GDPR consent on signup

```typescript
// apps/web/src/pages/Signup.tsx — add to patient signup form
<label>
  <input type="checkbox" required name="consent_health_processing" />
  I consent to processing of my health data for clinical report analysis
</label>
<label>
  <input type="checkbox" required name="consent_ai_analysis" />
  I consent to AI-assisted analysis of my lab reports
</label>
<label>
  <input type="checkbox" name="consent_research" />  {/* optional */}
  I consent to anonymized use of my data for research purposes
</label>
```

Store consent timestamps and versions in a `ConsentRecord` table.

---

## Comparison Summary

| | Approach A — VPS | Approach A — AWS | Approach B — Full Compliance |
|---|---|---|---|
| **Monthly cost** | ~€24 | ~$78 | ~$242 |
| **HIPAA eligible** | ✗ | ✗ | ✓ |
| **GDPR eligible** | ✗ | Partial | ✓ |
| **Supabase replaced** | ✓ | ✓ | ✓ |
| **Managed DB** | Neon (pgvector) | RDS + Neon | RDS + Neon (BAA) |
| **Auth** | Clerk | Clerk | Clerk (Enterprise, BAA) |
| **OCR fallback** | Mistral OK | Mistral OK | AWS Textract |
| **LLM providers** | Any | Any | AWS Bedrock or (OpenAI Enterprise + Vertex AI) |
| **Setup complexity** | Low | Medium | High |
| **Best for** | Pilots, demos, internal use | Developer-friendly scaling | Real clinical customers |

---

## Migration order (recommended)

1. **Replace Supabase Storage → S3** (or Hetzner Object Storage for VPS) — lowest risk, pure infra swap
2. **Replace Supabase Auth → Clerk** — update `AuthContext`, Passport JWT config, signup flow
3. **Replace Supabase pgvector → Neon** — just a `DATABASE_URL` change for Prisma + LangChain
4. **Deploy on VPS (Approach A)** — Docker Compose, Caddy, done
5. **When first clinical customer signs** — sign AWS BAA, Clerk Enterprise BAA, Neon BAA, swap Mistral → AWS Textract, swap Gemini API → Vertex AI, enable RDS encryption, surface audit log UI
