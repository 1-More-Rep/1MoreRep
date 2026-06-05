-- Indexes for FK/hot-column lookups that were missing after the prior pass.

-- RoutineItem.exerciseId: the default RESTRICT FK check on exercise delete otherwise
-- full-scans RoutineItem.
CREATE INDEX "RoutineItem_exerciseId_idx" ON "RoutineItem"("exerciseId");

-- AuditEvent target lookups (admin "history for X" queries) instead of a seq-scan.
CREATE INDEX "AuditEvent_targetType_targetId_idx" ON "AuditEvent"("targetType", "targetId");

-- Notification unread-count / unread-list (userId + readAt IS NULL).
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- PersonalRecord lookups by the source session.
CREATE INDEX "PersonalRecord_sessionId_idx" ON "PersonalRecord"("sessionId");

-- Session cleanup by absolute expiry.
CREATE INDEX "Session_absoluteExpiresAt_idx" ON "Session"("absoluteExpiresAt");

-- Per-user/day streak-risk-notify idempotency marker.
ALTER TABLE "UserStats" ADD COLUMN "lastStreakNudgeDay" TEXT;

-- FriendStreak: promote the plain-string userAId/userBId to real foreign keys so a user
-- delete cascades (no orphan streak rows). Clear any pre-existing orphans first so the
-- constraint can be added safely.
DELETE FROM "FriendStreak"
  WHERE "userAId" NOT IN (SELECT "id" FROM "User")
     OR "userBId" NOT IN (SELECT "id" FROM "User");

ALTER TABLE "FriendStreak"
  ADD CONSTRAINT "FriendStreak_userAId_fkey"
  FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FriendStreak"
  ADD CONSTRAINT "FriendStreak_userBId_fkey"
  FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
