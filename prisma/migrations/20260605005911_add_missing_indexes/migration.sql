-- CreateIndex
CREATE INDEX "PersonalRecord_exerciseId_idx" ON "PersonalRecord"("exerciseId");

-- CreateIndex
CREATE INDEX "SessionEntry_exerciseId_idx" ON "SessionEntry"("exerciseId");

-- CreateIndex
CREATE INDEX "WorkoutSession_ownerId_completedAt_idx" ON "WorkoutSession"("ownerId", "completedAt");

-- CreateIndex
CREATE INDEX "WorkoutSession_routineId_idx" ON "WorkoutSession"("routineId");

-- CreateIndex
CREATE INDEX "XpEvent_userId_workoutId_idx" ON "XpEvent"("userId", "workoutId");
