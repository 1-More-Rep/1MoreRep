#!/bin/sh
# Container entrypoint: apply migrations + seed (idempotent) on every boot,
# then hand off to the app. This doubles as the upgrade path (the master plan's
# "migrate deploy on boot"). Migrations are forward-only and safe to re-run.
set -e

# prisma + tsx resolve from the tools layer on PATH (/opt/tools/node_modules/.bin);
# the generated @prisma/client + engine live in /app/node_modules. No pnpm needed
# in the slim runner.
echo "[entrypoint] Applying database migrations (prisma migrate deploy)..."
prisma migrate deploy

echo "[entrypoint] Seeding (idempotent)..."
tsx prisma/seed/index.ts

echo "[entrypoint] Starting: $*"
exec "$@"
