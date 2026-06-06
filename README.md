# 1MoreRep

A self-hosted, multi-user **gym / fitness tracker PWA** — workout logging, routines, an
873-exercise library, a 2D muscle-fatigue model, an algorithmic + optional LLM-assisted
workout generator, body metrics and progress photos, and a Duolingo-style social layer
(XP, levels, streaks, weekly leagues, friends, and instance leaderboards).

Runs anywhere Docker runs. Your data stays on your server — no ads, no trackers, nothing
sold. Source for the public hosted instance lives at
**<https://github.com/1-More-Rep/1MoreRep>**.

- **Next.js 15** (App Router, TypeScript) + **React 19**
- **PostgreSQL 16** + **Prisma 6**
- Packaged as a self-contained **Docker Compose** stack (app + Postgres + scheduled-job runner)
- **PWA** + **Web Push**; deterministic workout generator with a pluggable, self-hosted **Ollama** LLM
- Optional bundled **Caddy** reverse proxy with automatic HTTPS (Let's Encrypt)

---

## Contents

- [Requirements](#requirements)
- [Quick start (one command)](#quick-start-one-command)
- [Manual installation (step by step)](#manual-installation-step-by-step)
- [HTTPS & reverse proxy](#https--reverse-proxy)
- [Updating an instance](#updating-an-instance)
- [Configuration reference](#configuration-reference)
- [Optional: local AI (Ollama)](#optional-local-ai-ollama)
- [Backups & data](#backups--data)
- [Local development](#local-development)
- [Project layout](#project-layout)
- [License](#license)

---

## Requirements

- A 64-bit Linux host (a small VPS is plenty; ~1 GB RAM works, 2 GB is comfortable).
- **Docker Engine** and the **Docker Compose v2** plugin (`docker compose …`, not the
  legacy `docker-compose`).
- `git`, `curl`, and `openssl` (all standard on most distros).
- For a public HTTPS instance: a **domain name** pointing at the host, and ports **80**
  and **443** free.

> You do **not** need Node.js or pnpm to run 1MoreRep — everything builds and runs inside
> Docker. Node/pnpm are only needed for [local development](#local-development).

Verify Docker is ready:

```bash
docker --version
docker compose version
docker info >/dev/null && echo "Docker daemon OK"
```

---

## Quick start (one command)

The fastest path. `install.sh` generates all secrets (including a Web Push VAPID
keypair), writes a locked-down `.env`, builds the images, starts the stack, applies
database migrations, seeds the exercise library, and prints your superadmin credentials.

```bash
git clone https://github.com/1-More-Rep/1MoreRep.git
cd 1MoreRep
./install.sh
```

It runs interactively and asks for:

- **Host port** to publish the app on (default `3000`; auto-suggests the next free port
  if it's taken).
- **Public URL** — e.g. `https://gym.example.com`. Entering an `https://` URL automatically
  enables the bundled Caddy proxy (auto-TLS) and binds the app to loopback. An
  `http://localhost:…` URL keeps it bring-your-own-proxy.
- **Superadmin email** — the first admin account.

Non-interactive / scripted use:

```bash
APP_PORT=8080 APP_URL=https://gym.example.com SUPERADMIN_EMAIL=you@example.com ./install.sh
# or via flags:
./install.sh --port 8080 --app-url https://gym.example.com --admin-email you@example.com
```

`install.sh` is **idempotent** — re-running never rotates existing secrets; it just
rebuilds and applies any pending migrations. When the app is healthy it prints a one-time
superadmin password:

```
════════ SUPERADMIN CREATED ════════
  Email:    you@example.com
  Password: <generated once — save it now>
════════════════════════════════════
```

Sign in and change the password immediately (you'll be prompted to). That's it — for
ongoing upgrades, see [Updating an instance](#updating-an-instance).

> Other flags: `--allow-root` (run as root, discouraged). Run `./install.sh` from the repo
> root.

---

## Manual installation (step by step)

If you'd rather not use `install.sh`, here is the exact same outcome by hand. The Docker
stack constructs `DATABASE_URL` itself from the `POSTGRES_*` values, so you only set a
handful of variables.

### 1. Clone the repository

```bash
git clone https://github.com/1-More-Rep/1MoreRep.git
cd 1MoreRep
```

### 2. Generate secrets

Only one secret is strictly required (`APP_KEY`); the rest enable Web Push and the
scheduled-job runner.

```bash
# APP_KEY — base64-encoded 32 bytes. Mandatory in production. Used as the single
# signing/encryption key (AES-256-GCM for secrets-at-rest, HMAC for IP fingerprints).
openssl rand -base64 32

# POSTGRES_PASSWORD — the database password.
openssl rand -base64 24

# JOB_SECRET — shared secret the cron sidecar uses to call the internal jobs endpoint.
openssl rand -base64 24

# VAPID keypair — for Web Push notifications. Prints a public and a private key.
docker run --rm node:22-alpine npx -y web-push generate-vapid-keys
```

### 3. Write `.env`

Create a `.env` file in the repo root. Replace every `…` with a generated value from the
previous step. This is the production set of variables the Docker stack reads:

```ini
NODE_ENV=production

# Public URL users reach the app at. Use https://… in front of a reverse proxy.
APP_URL=https://gym.example.com
# Host port the stack publishes (what you/the proxy connect to).
APP_PORT=3000
# Bind the published port to loopback when a reverse proxy fronts the app, so the
# plaintext port can't be reached directly. Use 0.0.0.0 for simple no-TLS LAN access.
APP_BIND=127.0.0.1
# Trust X-Forwarded-For / X-Real-IP (required when behind any reverse proxy).
TRUST_PROXY=true

# --- Database (the app builds DATABASE_URL from these) ---
POSTGRES_USER=onemorerep
POSTGRES_PASSWORD=…        # openssl rand -base64 24
POSTGRES_DB=onemorerep

# --- Secrets ---
APP_KEY=…                  # openssl rand -base64 32  (REQUIRED)
JOB_SECRET=…               # openssl rand -base64 24

# --- Web Push (optional but recommended; from web-push generate-vapid-keys) ---
VAPID_PUBLIC_KEY=…
VAPID_PRIVATE_KEY=…
VAPID_SUBJECT=mailto:you@example.com

# --- First admin (consumed by the boot-time seed) ---
SUPERADMIN_EMAIL=you@example.com
# Optional: set a password instead of having one generated and printed on first boot.
# SUPERADMIN_PASSWORD=

# --- Reverse proxy selection (see "HTTPS & reverse proxy") ---
# Leave empty for bring-your-own-proxy; set to "caddy" for the bundled HTTPS proxy.
COMPOSE_PROFILES=
CADDY_DOMAIN=
```

Lock it down:

```bash
chmod 600 .env
```

> **Notes on secrets.** SMTP (email) and LLM/Ollama settings are **not** in `.env` — you
> configure them later in the in-app admin panel, where they're stored encrypted in the
> database. There is intentionally no `SESSION_SECRET`; `APP_KEY` is the single secret.

### 4. Build and start the stack

```bash
docker compose build
docker compose up -d
```

On boot the app container automatically runs `prisma migrate deploy` (apply migrations)
and the idempotent seed (instance settings, superadmin, exercise library) — no manual
migration step needed. Migrations are forward-only and safe to re-run.

### 5. Wait for health and grab your admin password

```bash
# health endpoint returns 200 once the app is up
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:${APP_PORT:-3000}/api/health

# the one-time superadmin password is printed in the app logs on first boot
docker compose logs app | grep -A4 "SUPERADMIN CREATED"
```

Open `APP_URL`, sign in with the superadmin email + printed password, and change the
password when prompted. Done.

---

## HTTPS & reverse proxy

The app sets all of its own security headers (a per-request CSP nonce, HSTS,
X-Frame-Options, etc.) in `src/middleware.ts` — so a proxy only needs to terminate TLS and
forward requests. Pick **one** of:

### Option A — bundled Caddy (automatic HTTPS)

Caddy provisions and renews a Let's Encrypt certificate for you. In `.env`:

```ini
APP_URL=https://gym.example.com
APP_BIND=127.0.0.1
TRUST_PROXY=true
COMPOSE_PROFILES=caddy
CADDY_DOMAIN=gym.example.com   # the domain only, no scheme
```

Then `docker compose up -d`. Caddy needs host ports **80** and **443** free, and the
domain's DNS must already point at the host. (`install.sh` sets all of this automatically
when you give it an `https://` URL.)

### Option B — your own nginx / existing proxy

Front the app with a proxy you already run. In `.env` set `APP_BIND=127.0.0.1`,
`TRUST_PROXY=true`, and leave `COMPOSE_PROFILES=` empty so Caddy stays off. A ready-to-adapt
server block is in [`deploy/nginx.conf.example`](deploy/nginx.conf.example) — it proxies
`127.0.0.1:${APP_PORT}` and includes the WebSocket upgrade map. **Do not** add security
headers in nginx; the app already sends them (a second CSP would break the nonce'd inline
scripts).

### Option C — plain HTTP on a LAN

For a trusted local network with no TLS, set `APP_URL=http://<host>:<port>`,
`APP_BIND=0.0.0.0`, `TRUST_PROXY=false`, `COMPOSE_PROFILES=` and connect directly.

---

## Updating an instance

`update.sh` is the safe upgrade path for a git checkout:

```bash
./update.sh           # fetch the tracked branch; rebuild + redeploy ONLY if there are
                      # new commits, then wait for /api/health. A no-op exits instantly
                      # with zero downtime.
./update.sh --force   # rebuild + redeploy even when already up to date
./update.sh --help
```

What it does, in order: fetches the tracked branch and gates on "is there anything new?";
fast-forwards the checkout; **re-executes itself** if the pull changed `update.sh` (so the
new deploy logic runs, never the stale one); rebuilds the image; recreates the stack
(migrations + seed apply on boot); then polls `/api/health`. Your secrets in `.env` are
gitignored and preserved across updates.

For a checkout cloned over HTTPS, a plain `git pull` before `./update.sh --force` also
works if you'd rather pull manually.

---

## Configuration reference

Set in `.env` (read by `docker-compose.yml`). Generated automatically by `install.sh`.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `APP_URL` | yes (prod) | `http://localhost:3000` | Public URL the app is served at. |
| `APP_PORT` | no | `3000` | Host port the stack publishes. |
| `APP_BIND` | no | `0.0.0.0` | Host interface for the published port; use `127.0.0.1` behind a proxy. |
| `TRUST_PROXY` | no | `false` | Trust `X-Forwarded-For`/`X-Real-IP`. Set `true` behind any proxy. |
| `POSTGRES_USER` | yes | `onemorerep` | Database user. |
| `POSTGRES_PASSWORD` | yes (prod) | `devpassword` | Database password — the dev fallback is insecure; set a strong value for production. |
| `POSTGRES_DB` | yes | `onemorerep` | Database name. |
| `APP_KEY` | **yes** | — | base64 32 bytes. Single signing/encryption key. The app refuses to start in production without it. |
| `JOB_SECRET` | recommended | — | Shared secret for the cron sidecar → internal jobs endpoint. |
| `VAPID_PUBLIC_KEY` | for push | — | Web Push public key. |
| `VAPID_PRIVATE_KEY` | for push | — | Web Push private key. |
| `VAPID_SUBJECT` | for push | — | `mailto:` contact for push (e.g. `mailto:you@example.com`). |
| `SUPERADMIN_EMAIL` | yes (first boot) | — | Bootstraps the first admin account. |
| `SUPERADMIN_PASSWORD` | no | generated | Set to choose the admin password; otherwise one is generated and printed once. |
| `COMPOSE_PROFILES` | no | empty | `caddy` enables the HTTPS proxy; `ollama` the local LLM (comma-separate for both). |
| `CADDY_DOMAIN` | with Caddy | — | Domain Caddy issues a cert for (no scheme). |

> **Not in `.env`:** SMTP and LLM/Ollama configuration is managed in the **admin panel**
> and stored encrypted in the database. `DATABASE_URL` only matters for non-Docker local
> development — the Docker stack builds it from the `POSTGRES_*` values.

---

## Optional: local AI (Ollama)

The workout generator is deterministic by default. To enable the optional LLM assist with
a fully self-hosted model (nothing leaves your server):

```bash
# enable the ollama service (combine with caddy if you use it: COMPOSE_PROFILES=caddy,ollama)
COMPOSE_PROFILES=ollama docker compose up -d
# pull a model once it's running
docker compose exec ollama ollama pull llama3.2
```

The app reaches the model at `http://ollama:11434`, which matches the default LLM base URL.
Turn the assist on and pick the model in the admin panel.

---

## Backups & data

All persistent state lives in Docker named volumes:

| Volume | Holds |
|---|---|
| `db_data` | PostgreSQL — accounts, workouts, everything. |
| `uploads` | Progress photos (`/data/uploads`). |
| `caddy_data` / `caddy_config` | TLS certificates & Caddy state (if using Caddy). |
| `ollama_models` | Downloaded LLM models (if using Ollama). |

Back up the database with a logical dump, and archive the uploads volume:

```bash
# database → timestamped SQL dump
docker compose exec -T db pg_dump -U onemorerep onemorerep > backup-$(date +%F).sql

# restore
cat backup-YYYY-MM-DD.sql | docker compose exec -T db psql -U onemorerep -d onemorerep
```

---

## Local development

Node 22 + [pnpm](https://pnpm.io) (via Corepack) and a Postgres you can point at.

```bash
pnpm install
cp .env.example .env            # adjust DATABASE_URL if needed
docker compose up -d db         # or use your own Postgres
pnpm prisma:migrate             # apply migrations + seed (prisma migrate dev)
pnpm dev                        # http://localhost:3000
```

Quality gates:

```bash
pnpm typecheck      # tsc --noEmit
pnpm lint           # next lint
pnpm test           # vitest unit + integration
pnpm e2e            # playwright (builds + starts the app)
```

To exercise the full production stack locally:

```bash
docker compose up --build       # app + postgres + cron; health at /api/health
```

---

## Project layout

```
src/domain/      pure, framework-free, unit-tested logic (fatigue, generator, units, …)
src/server/      DB-bound services, LLM adapters, gamification, scheduled jobs
src/lib/         auth, crypto, mail, push, validation, env, logging
src/app/         Next.js routes (auth / app / admin / api)
src/components/   design-system primitives + feature components
src/i18n/        next-intl request config; messages/ holds en + de translations
prisma/          schema, migrations, seed (exercise library + superadmin bootstrap)
deploy/          Caddyfile, nginx example, crontab + cron image
homepage/        standalone marketing site (1morerep.de) — static, no build step
install.sh       one-command installer (generates secrets, builds, starts, seeds)
update.sh        self-updating deploy script (diff-gated, zero-downtime no-op)
```

---

## License

[MIT](LICENSE) © 2026 Maximilian Haaser.
