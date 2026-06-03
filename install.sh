#!/usr/bin/env bash
# 1MoreRep one-command installer.
# Idempotent: re-running never rotates existing secrets; it just rebuilds and
# applies pending migrations (the upgrade path). Generates an admin on first run.
set -euo pipefail

cd "$(dirname "$0")"

ALLOW_ROOT=0
ADMIN_EMAIL="${SUPERADMIN_EMAIL:-}"
APP_URL_ARG="${APP_URL:-}"
APP_PORT="${APP_PORT:-3000}"

while [ $# -gt 0 ]; do
  case "$1" in
    --allow-root) ALLOW_ROOT=1 ;;
    --admin-email) ADMIN_EMAIL="$2"; shift ;;
    --app-url) APP_URL_ARG="$2"; shift ;;
    --port) APP_PORT="$2"; shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done

log() { printf '\033[1;36m[install]\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m[install]\033[0m %s\n' "$*" >&2; }

# --- Preflight ---
if [ "$(id -u)" = "0" ] && [ "$ALLOW_ROOT" != "1" ]; then
  err "Refusing to run as root. Re-run as a normal user, or pass --allow-root."
  exit 1
fi
command -v docker >/dev/null 2>&1 || { err "docker is required."; exit 1; }
docker compose version >/dev/null 2>&1 || { err "docker compose v2 is required."; exit 1; }
docker info >/dev/null 2>&1 || { err "The Docker daemon is not running."; exit 1; }

# --- Secrets (.env) ---
if [ -f .env ]; then
  log "Existing .env detected — keeping secrets (upgrade mode)."
else
  log "Fresh install — generating secrets…"
  [ -z "$APP_URL_ARG" ] && read -r -p "Public URL (e.g. https://gym.example.com) [http://localhost:${APP_PORT}]: " APP_URL_ARG
  APP_URL_ARG="${APP_URL_ARG:-http://localhost:${APP_PORT}}"
  while [ -z "$ADMIN_EMAIL" ]; do read -r -p "Superadmin email: " ADMIN_EMAIL; done

  # Generate all secrets + a VAPID keypair in one throwaway node container.
  SECRETS_JSON="$(docker run --rm node:22-alpine node -e '
    const c = require("crypto");
    const { publicKey, privateKey } = c.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const pub = publicKey.export({ format: "jwk" });
    const priv = privateKey.export({ format: "jwk" });
    const x = Buffer.from(pub.x, "base64url"), y = Buffer.from(pub.y, "base64url");
    const vapidPublic = Buffer.concat([Buffer.from([4]), x, y]).toString("base64url");
    console.log(JSON.stringify({
      APP_KEY: c.randomBytes(32).toString("base64"),
      SESSION_SECRET: c.randomBytes(32).toString("base64"),
      POSTGRES_PASSWORD: c.randomBytes(18).toString("base64url"),
      JOB_SECRET: c.randomBytes(24).toString("base64url"),
      VAPID_PUBLIC_KEY: vapidPublic,
      VAPID_PRIVATE_KEY: priv.d,
    }));
  ')"
  get() { printf '%s' "$SECRETS_JSON" | sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p"; }

  # A public https URL gets the bundled Caddy reverse proxy (auto-TLS) via the
  # `caddy` compose profile; http/localhost stays bring-your-own-proxy.
  CADDY_DOMAIN=""
  COMPOSE_PROFILES=""
  case "$APP_URL_ARG" in
    https://*)
      CADDY_DOMAIN="${APP_URL_ARG#https://}"; CADDY_DOMAIN="${CADDY_DOMAIN%%/*}"
      COMPOSE_PROFILES="caddy"
      log "Public https URL — enabling the Caddy HTTPS proxy (domain: ${CADDY_DOMAIN})."
      ;;
  esac

  umask 077
  cat > .env <<EOF
NODE_ENV=production
APP_URL=${APP_URL_ARG}
APP_PORT=${APP_PORT}
TRUST_PROXY=true
COMPOSE_PROFILES=${COMPOSE_PROFILES}
CADDY_DOMAIN=${CADDY_DOMAIN}

POSTGRES_USER=onemorerep
POSTGRES_PASSWORD=$(get POSTGRES_PASSWORD)
POSTGRES_DB=onemorerep

APP_KEY=$(get APP_KEY)
SESSION_SECRET=$(get SESSION_SECRET)
JOB_SECRET=$(get JOB_SECRET)

VAPID_PUBLIC_KEY=$(get VAPID_PUBLIC_KEY)
VAPID_PRIVATE_KEY=$(get VAPID_PRIVATE_KEY)
VAPID_SUBJECT=mailto:${ADMIN_EMAIL}

SUPERADMIN_EMAIL=${ADMIN_EMAIL}
EOF
  chmod 600 .env
  log "Wrote .env (0600)."
fi

# --- Build + run (entrypoint applies migrations + seeds on boot) ---
log "Building images (this can take a few minutes)…"
docker compose build

log "Starting services…"
# UTC with explicit 'Z' — docker parses a zoneless --since as *local* time, which
# on a non-UTC host would reach back past this boot and re-print old credentials.
BOOT_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
docker compose up -d

log "Waiting for the app to become healthy…"
URL="http://localhost:${APP_PORT}/api/health"
for i in $(seq 1 60); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$URL" 2>/dev/null || echo 000)"
  [ "$code" = "200" ] && { log "App is healthy."; break; }
  sleep 5
  [ "$i" = "60" ] && { err "App did not become healthy in time. Check: docker compose logs app"; exit 1; }
done

# --- Surface superadmin credentials printed by the seed during THIS run only ---
# (--since avoids re-printing historical creds on idempotent re-runs.)
CREDS="$(docker compose logs app --since "$BOOT_TS" 2>/dev/null | sed -n '/SUPERADMIN CREATED/,/════════════════/p' || true)"
if [ -n "$CREDS" ]; then
  echo ""
  echo "$CREDS"
  echo "  ^ Save these now. Sign in and change the password immediately."
else
  log "Superadmin already existed (no new credentials)."
fi

log "Done. Open: ${APP_URL_ARG}"
