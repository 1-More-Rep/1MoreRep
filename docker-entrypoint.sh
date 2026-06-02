#!/bin/sh
# Container entrypoint: apply migrations + seed (idempotent) on every boot,
# then hand off to the app. This doubles as the upgrade path (the master plan's
# "migrate deploy on boot"). Migrations are forward-only and safe to re-run.
set -e

echo "[entrypoint] Applying database migrations (prisma migrate deploy)..."
pnpm exec prisma migrate deploy

echo "[entrypoint] Seeding (idempotent)..."
pnpm exec tsx prisma/seed/index.ts

echo "[entrypoint] Starting: $*"
exec "$@"
