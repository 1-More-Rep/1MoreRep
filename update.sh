#!/usr/bin/env bash
# 1MoreRep self-updating deploy script.
#
# What it does, in order:
#   1. Fetches the tracked branch and checks whether there is anything new
#      (the "is an update even needed?" gate). A no-op exits immediately with
#      ZERO downtime — no rebuild, no container recreate.
#   2. If new commits exist, fast-forwards the checkout.
#   3. SELF-AWARENESS: if the pull changed THIS script, it re-executes the
#      freshly-pulled copy so the new build/deploy logic runs — never the stale
#      in-memory version. (Guarded so it re-execs at most once.)
#   4. Rebuilds the image and recreates the stack. Migrations + the idempotent
#      seed apply automatically on container boot (docker-entrypoint.sh).
#   5. Polls /api/health so you know the new container actually came up.
#
# Secrets in .env are gitignored and preserved across updates. Safe to re-run.
#
# Usage:
#   ./update.sh            # update if there are changes, else exit 0
#   ./update.sh --force    # rebuild + redeploy even if already up to date
#   ./update.sh --help
set -euo pipefail

# Resolve our own real path so the re-exec and self-hash follow symlinks and
# work regardless of how we were invoked.
SELF="$(realpath "$0")"
cd "$(dirname "$SELF")"

FORCE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --force) FORCE=1 ;;
    -h|--help)
      sed -n '2,28p' "$SELF" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done

log()  { printf '\033[1;36m[update]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[update]\033[0m %s\n' "$*" >&2; }
err()  { printf '\033[1;31m[update]\033[0m %s\n' "$*" >&2; }

[ -f .env ] || { err "No .env found — run ./install.sh first."; exit 1; }

# ---------------------------------------------------------------------------
# PHASE 1 — fetch, diff-gate, self-update, re-exec.
# Skipped on the re-executed run (we are already on the new code by then).
# ---------------------------------------------------------------------------
if [ -z "${UPDATE_REEXECED:-}" ]; then
  if [ ! -d .git ]; then
    err "No .git here — this checkout can't self-update. Pull the code manually, then run with --force."
    exit 1
  fi

  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  log "On branch '${BRANCH}'. Fetching origin…"
  git fetch origin --quiet

  # Resolve the upstream ref. Prefer the configured @{u}; fall back to
  # origin/<branch> if no upstream is set on this checkout.
  if UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null)"; then
    :
  elif git rev-parse --verify --quiet "origin/${BRANCH}" >/dev/null; then
    UPSTREAM="origin/${BRANCH}"
    warn "No upstream set for '${BRANCH}'; using ${UPSTREAM}. Tip: git branch --set-upstream-to=${UPSTREAM}"
  else
    err "Can't determine an upstream branch to compare against. Set one with: git branch --set-upstream-to=origin/${BRANCH}"
    exit 1
  fi

  LOCAL="$(git rev-parse @)"
  REMOTE="$(git rev-parse "${UPSTREAM}")"
  BASE="$(git merge-base @ "${UPSTREAM}")"

  if [ "$LOCAL" = "$REMOTE" ]; then
    if [ "$FORCE" = "1" ]; then
      log "Already up to date — but --force given, rebuilding anyway."
    else
      log "Already up to date with ${UPSTREAM}. Nothing to do."
      exit 0
    fi
  elif [ "$LOCAL" = "$BASE" ]; then
    COUNT="$(git rev-list --count "@..${UPSTREAM}")"
    log "${COUNT} new commit(s) on ${UPSTREAM}. Updating…"

    # Capture our own content hash BEFORE pulling so we can detect a change to
    # this very script.
    SELF_HASH="$(sha256sum "$SELF" | cut -d' ' -f1)"

    git pull --ff-only

    NEW_HASH="$(sha256sum "$SELF" | cut -d' ' -f1)"
    if [ "$NEW_HASH" != "$SELF_HASH" ]; then
      log "update.sh itself changed — re-executing the new version…"
      # The re-exec'd run skips Phase 1 and always rebuilds (Phase 2), so no
      # need to forward --force.
      exec env UPDATE_REEXECED=1 "$SELF"
    fi
  elif [ "$REMOTE" = "$BASE" ]; then
    warn "Local branch is AHEAD of ${UPSTREAM} (unpushed commits). Nothing to pull; rebuilding current code."
  else
    err "Local branch has DIVERGED from ${UPSTREAM} (local commits + remote commits)."
    err "Refusing to auto-merge. Resolve manually, e.g.:"
    err "    git stash            # if you have local edits"
    err "    git reset --hard ${UPSTREAM}   # discard local commits to match remote"
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# PHASE 2 — build, deploy, verify. Always runs the up-to-date code.
# ---------------------------------------------------------------------------
log "Building image…"
docker compose build

log "Recreating stack (migrations + seed apply on boot)…"
docker compose up -d

# Read the host port back from .env to know where to health-check.
APP_PORT="$(grep -E '^APP_PORT=' .env | tail -n1 | cut -d= -f2-)"
APP_PORT="${APP_PORT//[\"\' ]/}"   # strip quotes/whitespace
APP_PORT="${APP_PORT:-3000}"

log "Waiting for the app to become healthy on :${APP_PORT}…"
URL="http://localhost:${APP_PORT}/api/health"
HEALTHY=0
for i in $(seq 1 60); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$URL" 2>/dev/null || echo 000)"
  if [ "$code" = "200" ]; then HEALTHY=1; log "App is healthy."; break; fi
  sleep 5
done
if [ "$HEALTHY" != "1" ]; then
  err "App did not become healthy in time. Check: docker compose logs app"
  exit 1
fi

# Reclaim disk from the previous image layers (repeated rebuilds add up).
docker image prune -f >/dev/null 2>&1 || true

log "Update complete."
