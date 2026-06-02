#!/usr/bin/env bash
# Pull the latest code/images and apply pending migrations (on boot). Secrets in
# .env are preserved. Safe to run repeatedly.
set -euo pipefail
cd "$(dirname "$0")"

log() { printf '\033[1;36m[upgrade]\033[0m %s\n' "$*"; }

[ -f .env ] || { echo "No .env found — run ./install.sh first." >&2; exit 1; }

if [ -d .git ]; then
  log "Pulling latest code…"
  git pull --ff-only || log "git pull skipped (not fast-forwardable)."
fi

log "Rebuilding and restarting (migrations apply automatically on boot)…"
docker compose build
docker compose up -d

log "Done."
