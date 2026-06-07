-- RFC 6238 §5.2 replay defence: remember the last accepted TOTP time-step.
-- Nullable, no default → safe on populated tables (existing users get NULL and
-- their next code simply establishes the baseline).
ALTER TABLE "User" ADD COLUMN     "totpLastUsedStep" BIGINT;

-- The login backup-code fallback claims a row by (userId, codeHash); make it a
-- direct index lookup instead of scanning all of a user's codes. The composite
-- index also covers the previous userId-only queries (leftmost prefix).
DROP INDEX "BackupCode_userId_idx";
CREATE INDEX "BackupCode_userId_codeHash_idx" ON "BackupCode"("userId", "codeHash");
