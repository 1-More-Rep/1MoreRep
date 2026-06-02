# 1MoreRep runtime image.
# P0: correctness-first (full deps in the runner so prisma CLI + tsx are available
# for migrate/seed-on-boot). A slimmer standalone runner is a P12 hardening task.

FROM node:22-slim AS base
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
RUN pnpm install --frozen-lockfile || pnpm install
COPY . .
RUN pnpm prisma generate && pnpm build

# ---- runtime stage ----
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app ./
RUN groupadd -g 1001 nodejs \
  && useradd -u 1001 -g nodejs -m nextjs \
  && chmod +x /app/docker-entrypoint.sh \
  && chown -R nextjs:nodejs /app
USER nextjs
EXPOSE 3000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["pnpm", "start"]
