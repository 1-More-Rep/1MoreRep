-- Persistent fixed-window rate-limit store for the security-sensitive limiters
-- (login / 2FA / email). Backing these in the DB instead of process memory means a
-- container restart (every ./update.sh) no longer resets the brute-force budget.
-- Additive new table → safe on populated DBs.
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- Cheap expired-row sweep (run by the award.reconcile job).
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");
