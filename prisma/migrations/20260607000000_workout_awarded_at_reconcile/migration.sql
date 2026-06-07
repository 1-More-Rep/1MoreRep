-- Idempotency anchor + reconcile signal for workout XP/streak awards.
-- Nullable, no default → safe on populated tables.
ALTER TABLE "WorkoutSession" ADD COLUMN     "awardedAt" TIMESTAMP(3);

-- Backfill: every session already COMPLETED before this column existed has, by
-- definition, already had its award processed. Stamp it as awarded (using completedAt)
-- so the new award.reconcile job does NOT re-credit historical workouts. Migrations
-- run at container boot BEFORE the app starts, so no concurrent finishSession can race
-- this UPDATE.
UPDATE "WorkoutSession" SET "awardedAt" = "completedAt" WHERE "status" = 'COMPLETED' AND "awardedAt" IS NULL;

-- award.reconcile scans (status, awardedAt) for COMPLETED sessions still unawarded.
CREATE INDEX "WorkoutSession_status_awardedAt_idx" ON "WorkoutSession"("status", "awardedAt");
