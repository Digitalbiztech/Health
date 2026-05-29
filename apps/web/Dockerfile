# syntax=docker/dockerfile:1.7
# Build context: repo root.

ARG NODE_VERSION=20-alpine
ARG NGINX_VERSION=1.27-alpine

# Vite reads VITE_* values at build time, so they must be baked in.
ARG VITE_API_URL=http://localhost:4000
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

# ─── Stage 1: install deps ──────────────────────────────────────
FROM node:${NODE_VERSION} AS deps
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /repo

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/phi-masks/package.json packages/phi-masks/package.json

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --filter @app/web... --frozen-lockfile

# ─── Stage 2: build static assets ──────────────────────────────
FROM node:${NODE_VERSION} AS build
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /repo

ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_API_URL=$VITE_API_URL \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./
COPY packages ./packages
COPY apps/web ./apps/web

RUN pnpm --filter @app/web build

# ─── Stage 3: serve with nginx ─────────────────────────────────
FROM nginx:${NGINX_VERSION} AS runner

RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
