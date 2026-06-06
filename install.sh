#!/usr/bin/env bash
# 1MoreRep one-command installer.
# Idempotent: re-running never rotates existing secrets; it just rebuilds and
# applies pending migrations (the upgrade path). Generates an admin on first run.
set -euo pipefail

cd "$(dirname "$0")"

ALLOW_ROOT=0
ADMIN_EMAIL="${SUPERADMIN_EMAIL:-}"
APP_URL_ARG="${APP_URL:-}"
# Treat a port supplied via the APP_PORT env var (or --port below) as explicit: honor it
# and fail fast on a collision, rather than silently auto-picking another port.
APP_PORT_EXPLICIT=0; [ -n "${APP_PORT:-}" ] && APP_PORT_EXPLICIT=1
APP_PORT="${APP_PORT:-3000}"
PORT_FLAG_SET=0

while [ $# -gt 0 ]; do
  case "$1" in
    --allow-root) ALLOW_ROOT=1 ;;
    --admin-email) ADMIN_EMAIL="$2"; shift ;;
    --app-url) APP_URL_ARG="$2"; shift ;;
    --port) APP_PORT="$2"; PORT_FLAG_SET=1; shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done

log() { printf '\033[1;36m[install]\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m[install]\033[0m %s\n' "$*" >&2; }

# --- Port helpers ---
valid_port() { case "$1" in (''|*[!0-9]*) return 1 ;; esac; [ "$1" -ge 1 ] && [ "$1" -le 65535 ]; }

# True (returns 0) when nothing is listening on TCP port $1 on this host. Tries ss,
# then lsof, then a loopback connect — so it degrades gracefully on minimal hosts.
is_port_free() {
  local p="$1"
  if command -v ss >/dev/null 2>&1; then
    ! ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE ":${p}\$"
  elif command -v lsof >/dev/null 2>&1; then
    ! lsof -iTCP:"$p" -sTCP:LISTEN -n -P >/dev/null 2>&1
  else
    ! (exec 3<>"/dev/tcp/127.0.0.1/$p") 2>/dev/null
  fi
}

# Echo the first free TCP port at or after $1.
find_free_port() { local p="$1"; while ! is_port_free "$p"; do p=$((p + 1)); done; printf '%s' "$p"; }

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
  # Upgrade keeps the committed config, so read the host port + URL back from the
  # existing .env — otherwise the shell defaults above are stale and the health
  # check below would poll the wrong port (false "not healthy"). Changing the port
  # on an existing install means editing APP_PORT in .env directly, so flag --port
  # as ineffective if it was passed here.
  [ "$PORT_FLAG_SET" = 1 ] && log "Note: --port is ignored in upgrade mode; edit APP_PORT in .env to change the port."
  ENV_PORT="$(sed -n 's/^APP_PORT=//p' .env | head -n1)"
  [ -n "$ENV_PORT" ] && APP_PORT="$ENV_PORT"
  ENV_URL="$(sed -n 's/^APP_URL=//p' .env | head -n1)"
  [ -n "$ENV_URL" ] && APP_URL_ARG="$ENV_URL"
else
  log "Fresh install — generating secrets…"

  # --- Host port selection ---
  # Pick the published host port up front so the localhost URL default can reference it.
  # If the port was pinned (--port / APP_PORT), honor it but fail fast on a collision.
  # Otherwise pick a free default and, in an interactive shell, let the user confirm.
  if [ "$PORT_FLAG_SET" = 1 ] || [ "$APP_PORT_EXPLICIT" = 1 ]; then
    valid_port "$APP_PORT" || { err "Invalid port: ${APP_PORT}"; exit 1; }
    if ! is_port_free "$APP_PORT"; then
      err "Requested port ${APP_PORT} is already in use. Free it or pick another (next free: $(find_free_port "$APP_PORT"))."
      exit 1
    fi
  else
    DEFAULT_PORT="$APP_PORT"
    if ! is_port_free "$DEFAULT_PORT"; then
      DEFAULT_PORT="$(find_free_port "$DEFAULT_PORT")"
      log "Port ${APP_PORT} is in use; suggesting ${DEFAULT_PORT}."
    fi
    if [ -t 0 ]; then
      while :; do
        read -r -p "Host port to publish the app on [${DEFAULT_PORT}]: " APP_PORT_IN
        APP_PORT="${APP_PORT_IN:-$DEFAULT_PORT}"
        valid_port "$APP_PORT" || { err "Not a valid port: ${APP_PORT}"; continue; }
        is_port_free "$APP_PORT" && break
        err "Port ${APP_PORT} is already in use; pick another."
      done
    else
      APP_PORT="$DEFAULT_PORT"
      log "Non-interactive shell — using port ${APP_PORT}."
    fi
  fi

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
  # Default: publish the app on all interfaces (simple no-TLS LAN access). When Caddy fronts
  # the app for TLS, bind the app port to loopback only so plaintext traffic can't bypass TLS.
  APP_BIND="0.0.0.0"
  case "$APP_URL_ARG" in
    https://*)
      CADDY_DOMAIN="${APP_URL_ARG#https://}"; CADDY_DOMAIN="${CADDY_DOMAIN%%/*}"
      COMPOSE_PROFILES="caddy"
      APP_BIND="127.0.0.1"
      log "Public https URL — enabling the Caddy HTTPS proxy (domain: ${CADDY_DOMAIN}); app port bound to loopback."
      # Caddy needs host ports 80 + 443 for ACME + HTTPS. Warn (don't block) if either is
      # taken — e.g. another reverse proxy is already running — since the stack `up` would
      # then fail. In that case front the app with your existing proxy instead (see
      # deploy/nginx.conf.example) and leave COMPOSE_PROFILES empty.
      for cp in 80 443; do
        is_port_free "$cp" || err "Warning: port ${cp} is already in use — Caddy will fail to bind it. Use your existing proxy instead (deploy/nginx.conf.example) and unset COMPOSE_PROFILES."
      done
      ;;
  esac

  # Let the operator choose which host interface the app port binds to. Default is the
  # value chosen above (loopback when Caddy fronts TLS, all-interfaces otherwise). Pick
  # 0.0.0.0 to expose it on all interfaces (e.g. when fronting with your own external
  # proxy), or 127.0.0.1 to keep it loopback-only.
  if [ -t 0 ]; then
    while :; do
      read -r -p "Host interface to bind the app port to (0.0.0.0 = all, 127.0.0.1 = loopback) [${APP_BIND}]: " APP_BIND_IN
      APP_BIND="${APP_BIND_IN:-$APP_BIND}"
      case "$APP_BIND" in
        ''|*[!0-9.]*) err "Enter an IPv4 address, e.g. 0.0.0.0 or 127.0.0.1."; continue ;;
      esac
      break
    done
    if [ -n "$COMPOSE_PROFILES" ] && [ "$APP_BIND" != "127.0.0.1" ]; then
      log "Note: APP_BIND=${APP_BIND} exposes the plaintext app port on that interface even though Caddy terminates TLS — firewall it, or use 127.0.0.1 to keep it loopback-only."
    fi
  fi

  umask 077
  cat > .env <<EOF
NODE_ENV=production
APP_URL=${APP_URL_ARG}
APP_PORT=${APP_PORT}
APP_BIND=${APP_BIND}
TRUST_PROXY=true
COMPOSE_PROFILES=${COMPOSE_PROFILES}
CADDY_DOMAIN=${CADDY_DOMAIN}

POSTGRES_USER=onemorerep
POSTGRES_PASSWORD=$(get POSTGRES_PASSWORD)
POSTGRES_DB=onemorerep

APP_KEY=$(get APP_KEY)
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

# Read DB creds back from .env (present in both fresh-install and upgrade paths).
DB_USER="$(sed -n 's/^POSTGRES_USER=//p' .env | head -n1)"
DB_PASS="$(sed -n 's/^POSTGRES_PASSWORD=//p' .env | head -n1)"
DB_NAME="$(sed -n 's/^POSTGRES_DB=//p' .env | head -n1)"

# Start Postgres first and force its role password to match .env BEFORE the app boots.
# Postgres only applies POSTGRES_PASSWORD when it initializes an EMPTY data directory, so
# a re-install over an existing db_data volume (same compose project name) that was first
# created with a different password leaves the app unable to authenticate — an endless
# "P1000: Authentication failed" restart loop. Reconciling the role password here makes
# re-installs idempotent; it's a harmless no-op on a freshly-initialized volume.
log "Starting database…"
docker compose up -d db
log "Waiting for the database to accept connections…"
for i in $(seq 1 30); do
  docker compose exec -T db pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1 && break
  sleep 2
  [ "$i" = "30" ] && { err "Database did not become ready. Check: docker compose logs db"; exit 1; }
done
if [ -n "$DB_PASS" ]; then
  log "Reconciling database credentials…"
  DB_PASS_SQL="$(printf '%s' "$DB_PASS" | sed "s/'/''/g")"   # SQL-escape single quotes
  docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" \
    -c "ALTER USER \"$DB_USER\" WITH PASSWORD '${DB_PASS_SQL}';" >/dev/null 2>&1 \
    || err "Could not reconcile the DB password automatically; if the app logs show P1000, re-run ./install.sh."
fi

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
