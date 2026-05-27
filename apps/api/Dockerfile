# syntax=docker/dockerfile:1.7
# Build context: repo root (so we can copy the pnpm workspace + packages/).

ARG NODE_VERSION=22-alpine

# ─── Stage 1: install deps ──────────────────────────────────────
FROM node:${NODE_VERSION} AS deps
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /repo

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/phi-masks/package.json packages/phi-masks/package.json

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --filter @app/api... --frozen-lockfile

# ─── Stage 2: build (TypeScript → dist, Prisma client) ──────────
FROM node:${NODE_VERSION} AS build
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /repo

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api

WORKDIR /repo/apps/api
# prisma.config.ts reads DIRECT_DATABASE_URL eagerly via env(), even for `generate`.
# We inject a placeholder at build time; the real URL is provided at runtime.
ENV DIRECT_DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder \
    DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
RUN pnpm run db:generate \
    && pnpm run build

# ─── Stage 3: prod runtime ──────────────────────────────────────
FROM node:${NODE_VERSION} AS runner
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /repo

ENV NODE_ENV=production

# Carry over the fully-installed workspace from the build stage.
# pnpm scatters packages across .pnpm/, app-local node_modules, and symlinks,
# so reproducing it with `--prod` here is fragile — copying is simpler and the
# devDependency footprint (tsc, prisma CLI) is small.
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json

WORKDIR /repo/apps/api

EXPOSE 4000
CMD ["node", "dist/app.js"]
