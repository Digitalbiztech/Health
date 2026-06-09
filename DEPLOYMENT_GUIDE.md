# Deployment Guide — Auriem (Report Viewer)

A full-stack monorepo with three deployable units:

| Unit | Tech | Port |
|------|------|------|
| `apps/web` | React + Vite (static) | — |
| `apps/api` | Express + Prisma + BullMQ (Node.js) | 4000 |
| `apps/extraction` | FastAPI (Python) | 8001 |

**External dependencies:** PostgreSQL (Supabase), Redis (BullMQ queues).

---

## Overview — What Fits Where

| Service | Vercel | Cloudflare Pages | Render | Railway | Fly.io |
|---------|--------|-----------------|--------|---------|--------|
| Frontend (static) | ✅ Perfect | ✅ Perfect | ✅ OK | ✅ OK | ❌ Overkill |
| API (Node.js) | ⚠️ Serverless-only | ❌ | ✅ Web Service | ✅ Web Service | ✅ Machine |
| Extraction (Python) | ❌ | ❌ | ✅ Web Service | ✅ Service | ✅ Machine |
| Redis | ❌ | ❌ | ✅ (paid add-on) | ✅ (paid add-on) | ✅ Sidecar |
| PostgreSQL | ✅ Supabase | ✅ Supabase | ✅ Supabase | ✅ Supabase | ✅ Supabase |

---

## 1. Supabase (Database & Auth)

Already configured — create a project at [supabase.com](https://supabase.com).

1. Create a new project.
2. Go to **Project Settings → Database** and copy the connection strings.
3. Go to **Project Settings → API** and copy `Project URL`, `anon key`, `service_role key`, and `JWT secret`.
4. Run migrations:
   ```bash
   pnpm install
   cd apps/api
   npx prisma migrate deploy
   ```

---

## 2. Upstash (Free Redis)

BullMQ requires Redis. [Upstash](https://upstash.com) offers a free tier (10 MB).

1. Create a free Redis database.
2. Copy the **UPSTASH_REDIS_REST_URL** and **UPSTASH_REDIS_REST_TOKEN**.

The API currently expects a standard `REDIS_URL`. You have two options:

**Option A — Use Upstash REST client** (simpler, no TCP needed):
- The API uses `ioredis` via `src/lib/redis.ts`. Replace with `@upstash/redis`.
- Set `REDIS_URL` to the Upstash REST URL.

**Option B — Use Upstash with TLS**:
- Set `REDIS_URL` to the Upstash TLS endpoint (`rediss://...`).

---

## 3. Deploy Frontend (Vercel / Cloudflare Pages)

### Vercel (Recommended)

1. Push to GitHub.
2. Go to [vercel.com](https://vercel.com), import the repo.
3. Configure:

| Setting | Value |
|---------|-------|
| **Root Directory** | `apps/web` |
| **Build Command** | `cd ../.. && pnpm install --filter @app/web... && pnpm --filter @app/web build` |
| **Output Directory** | `dist` |
| **Package Manager** | `pnpm` |

4. Set environment variables:

```
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-anon-key>
VITE_API_URL=<your-render-api-url>  # e.g. https://your-api.onrender.com
```

5. Deploy.

> **Note:** Set `BYPASS_AUTH = false` in `apps/web/src/lib/api.ts` before deploying to production.

### Cloudflare Pages

1. Push to GitHub.
2. Go to [Cloudflare Dashboard → Pages](https://dash.cloudflare.com), connect repo.
3. Configure:

| Setting | Value |
|---------|-------|
| **Root Directory** | `apps/web` |
| **Build Command** | `pnpm install --filter @app/web... && pnpm --filter @app/web build` |
| **Build Output** | `dist` |
| **Environment Variables** | Same as Vercel (all `VITE_*` vars) |

---

## 4. Deploy API (Render)

[Render](https://render.com) offers a free web service tier (sleeps after inactivity, 750 hours/month).

### Web Service

1. Create a **New Web Service** → connect your GitHub repo.
2. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `auriem-api` |
| **Root Directory** | `apps/api` |
| **Build Command** | `cd ../.. && corepack enable && pnpm install --filter @app/api... && pnpm run db:generate && pnpm run build` |
| **Start Command** | `node dist/app.js` |
| **Runtime** | Node (use Node 22 — Docker not needed) |

3. Add environment variables (all from `.env.example`):

| Variable | Notes |
|----------|-------|
| `PORT` | Render sets this automatically (use `$PORT` or leave default 4000) |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Supabase connection string (with `?pgbouncer=true`) |
| `DIRECT_DATABASE_URL` | Supabase direct connection string |
| `SUPABASE_URL` | From Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase project |
| `SUPABASE_JWT_SECRET` | From Supabase project |
| `CORS_ORIGIN` | Your frontend URL (e.g. `https://auriem.vercel.app`) |
| `REDIS_URL` | Upstash Redis URL |
| `EXTRACTION_SERVICE_URL` | Your extraction service URL (skip if not deploying) |
| `EXTRACTION_SERVICE_TIMEOUT_MS` | `120000` |
| `OPENAI_API_KEY` | Optional |

4. Deploy.

> **Caveats:** Free tier sleeps after 15 min of inactivity. Wakes on request (takes ~30s). BullMQ workers will stop when sleeping. Consider $7/month plan for active operation.

---

## 5. Deploy Extraction Microservice (Render or Railway)

### Render

Same process as the API — create a **New Web Service**:

| Setting | Value |
|---------|-------|
| **Root Directory** | _Leave empty_ (repo root build context) |
| **Runtime** | **Docker** (Python not natively supported on free tier, use the Dockerfile) |
| **Build Command** | _Leave empty_ (uses Dockerfile) |
| **Start Command** | _Leave empty_ |
| **Dockerfile Path** | `apps/extraction/Dockerfile` |

Environment variables:

```
OPENAI_API_KEY=<your-key>
OPENAI_MODEL=gpt-4o-mini
MISTRAL_API_KEY=<optional>
```

### Railway

1. Go to [railway.com](https://railway.com), create a new project.
2. Add a service from GitHub → select `apps/extraction`.
3. Set `OPENAI_API_KEY` in the environment.
4. Deploy.

> **Note:** The extraction service uses PyMuPDF and spaCy models. The Docker build may take 5–10 minutes. Railway's free tier includes $5 credit/month.

---

## 6. Deploy Backend on Railway (Alternative to Render)

1. Create a Railway project.
2. Add service → GitHub → select the repo.
3. Configure root directory as `apps/api`.
4. Build command:
   ```bash
   cd ../.. && pnpm install --filter @app/api... && pnpm run db:generate && pnpm run build
   ```
5. Start command: `node dist/app.js`
6. Add environment variables (same as Render table above).

---

## 7. Full Stack with Docker Compose (Cheapest Option)

For the most control and lowest cost, deploy everything on a single VM with Docker.

### Option A: Single VPS ($6–12/month)

- **Hetzner CX22** (~€3.99/mo) or **DigitalOcean Droplet** ($6/mo)
- Run `docker compose up --build`

### Option B: Render + Docker (All-in-one)

Create a **Render Web Service** with Docker and the root Dockerfile:

| Setting | Value |
|---------|-------|
| **Root Directory** | `.` (repo root) |
| **Runtime** | Docker |
| **Dockerfile Path** | `Dockerfile` |

You would need a **single Dockerfile** that builds and runs all services (or use `docker compose` in a Render Blueprint).

---

## 8. What Won't Work

| Platform | Why Not |
|----------|---------|
| **Cloudflare Workers** | No persistent server, no Redis/Puppeteer, no Python. Workers have 128 MB memory limit (Puppeteer needs more). |
| **Vercel Serverless Functions** | No BullMQ/Redis support. Function timeout of 60s (Hobby) vs. long-running extraction jobs. No WebSocket/SSE. |
| **Netlify Functions** | Same limitations as Vercel. |

---

## Summary — Recommended Setup

| Service | Platform | Cost |
|---------|----------|------|
| Database | Supabase (PostgreSQL) | Free |
| Redis | Upstash | Free |
| Frontend | Vercel | Free |
| API | Render (Web Service) | Free (sleeps) / $7/mo |
| Extraction | Not deployed (skip), OR Railway | $5/mo credit |

Total: **$0/month** (with API sleep caveats) or **~$12–15/month** for active 24/7.

---

## Quick Start Checklist

- [ ] Supabase project created and migrated
- [ ] Upstash Redis created
- [ ] `BYPASS_AUTH` set to `false` in `apps/web/src/lib/api.ts`
- [ ] Vercel project created with `VITE_*` env vars
- [ ] Render API service created with all env vars
- [ ] CORS_ORIGIN set to your Vercel frontend URL
- [ ] Extraction service deployed (or EXTRACTION_SERVICE_URL left empty — API checks health)
