# 1MoreRep runtime image.
# Slim, standalone runner: ships only runtime artifacts (.next/standalone, static,
# public, prisma) — no app source, no devDeps (eslint/vitest/playwright). The boot
# entrypoint still runs `prisma migrate deploy` + the tsx seed; those CLIs live in
# a tiny tools layer so they're available without shipping the whole build tree.
#
# Base pinned by digest (node:22-slim, the multi-arch index digest from Docker Hub)
# for reproducible, supply-chain-safe builds. Re-resolve with:
#   docker manifest inspect node:22-slim | grep digest   (use the index/list digest)
FROM node:22-slim@sha256:7af03b14a13c8cdd38e45058fd957bf00a72bbe17feac43b1c15a689c029c732 AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable
WORKDIR /app
# Pin pnpm to match the repo's packageManager field (host/CI parity, reproducible builds).
COPY package.json ./
RUN corepack install

# ---- build stage ----
FROM base AS build
COPY package.json pnpm-lock.yaml* ./
# No `|| pnpm install` fallback: a lockfile that doesn't match package.json must FAIL the
# build, not silently resolve fresh (unpinned) versions and defeat supply-chain integrity.
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm prisma generate && pnpm build

# ---- tools stage ----
# A self-contained node_modules holding ONLY the CLIs the entrypoint needs
# (prisma + tsx) and their deps — installed in isolation so it carries its own
# bin (.bin/prisma, .bin/tsx) and never drags app/dev packages into the runner.
# Versions are read from the app's package.json so the two stay in lockstep.
# node-linker=hoisted keeps node_modules flat + relocatable (no pnpm store symlinks),
# which is what lets us COPY the whole tree into the runner verbatim.
FROM base AS tools
WORKDIR /tools
COPY package.json /app/package.json
# onlyBuiltDependencies approves the install scripts pnpm 9 blocks by default —
# prisma/@prisma/engines fetch the query engine, esbuild (via tsx) fetches its
# native binary; without them the CLIs can't run, and pnpm exits non-zero.
RUN node -e "const p=require('/app/package.json'); require('fs').writeFileSync('package.json', JSON.stringify({name:'tools',private:true,packageManager:p.packageManager,dependencies:{prisma:p.dependencies.prisma,tsx:p.dependencies.tsx},pnpm:{onlyBuiltDependencies:['@prisma/engines','prisma','esbuild']}},null,2))" \
  && pnpm install --prod --node-linker=hoisted --no-frozen-lockfile

# ---- runtime stage ----
FROM node:22-slim@sha256:7af03b14a13c8cdd38e45058fd957bf00a72bbe17feac43b1c15a689c029c732 AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1 \
    # Entrypoint resolves `prisma` and `tsx` from the tools layer's bin dir.
    PATH=/opt/tools/node_modules/.bin:$PATH
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Runtime artifacts only.
# .next/standalone bundles server.js + the traced runtime node_modules — which,
# verified, already includes @prisma/client AND the native query engine
# (.pnpm/@prisma+client*/node_modules/.prisma/client/libquery_engine-*.so.node)
# under this project's pnpm layout, so no separate Prisma copy is needed.
# static + public are served by it; prisma/ holds the schema, migrations and seed.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
# The boot-time seed (`tsx prisma/seed/index.ts`, run by the entrypoint) imports a
# little shared app code — src/lib/auth/password (argon2 hashing for the superadmin)
# and src/domain/exercises/muscleWeights (curated weights, shared with the generator,
# so NOT duplicated into the seed). tsx resolves these lazily, loading only the seed's
# import graph — no server-only/Next modules are pulled in. Ship src/ so the seed runs.
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/docker-entrypoint.sh ./docker-entrypoint.sh

# CLI tools for the entrypoint (prisma migrate deploy + tsx seed), kept separate
# from the app's traced node_modules so neither clobbers the other.
COPY --from=tools /tools/node_modules /opt/tools/node_modules

# Create the uploads mountpoint and own it as the runtime user BEFORE the named volume
# mounts over it: a first-time named volume inherits the image directory's ownership, so
# this is what lets the non-root `nextjs` user actually write progress photos to
# /data/uploads (UPLOAD_DIR). Without it the volume is root-owned and writes fail with EACCES.
RUN groupadd -g 1001 nodejs \
  && useradd -u 1001 -g nodejs -m nextjs \
  && chmod +x /app/docker-entrypoint.sh \
  && mkdir -p /data/uploads \
  && chown -R nextjs:nodejs /app /data
USER nextjs
EXPOSE 3000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
# Standalone server (replaces `next start`, which isn't available in the slim image).
CMD ["node", "server.js"]
