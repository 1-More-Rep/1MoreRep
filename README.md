# 1MoreRep

A self-hosted, multi-user **gym/fitness tracker PWA** — workout logging, routines, an
exercise library, a 2D muscle-fatigue model, an algorithmic + LLM-assisted workout
generator, body metrics, and a Duolingo-style social layer (XP, leagues, streaks,
friends, instance leaderboards).

> Status: under active construction. See the phased build plan in
> `~/.claude/plans/tingly-swimming-kurzweil.md`.

## Stack

- **Next.js 15** (App Router, TypeScript) + React 19
- **PostgreSQL** + **Prisma**
- Self-hosted via **Docker Compose** + a one-command install script (P3)
- PWA + Web Push (P11); deterministic workout generator + pluggable Ollama LLM (P7)

## Develop

```bash
pnpm install
cp .env.example .env            # adjust DATABASE_URL if needed
docker compose up -d db         # or point DATABASE_URL at your own Postgres
pnpm prisma migrate deploy      # apply migrations
pnpm dev                        # http://localhost:3000
```

## Verify

```bash
pnpm typecheck      # tsc --noEmit
pnpm lint           # next lint
pnpm test           # vitest unit/integration
pnpm e2e            # playwright (builds + starts the app)
```

## Run the whole stack

```bash
docker compose up --build       # app + postgres; health at /api/health
```

## Project layout

```
src/domain/    pure, framework-free, unit-tested logic (fatigue, generator, units, ...)
src/server/    DB-bound services, LLM adapters, gamification, jobs
src/lib/       auth, crypto, mail, push, validation, env, logging
src/app/       Next.js routes (auth / app / admin / api)
src/components/ design-system primitives + feature components
prisma/        schema, migrations, seed
```
