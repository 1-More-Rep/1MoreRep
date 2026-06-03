-- CreateEnum
CREATE TYPE "Goal" AS ENUM ('HYPERTROPHY', 'STRENGTH', 'ENDURANCE', 'GENERAL');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "PrKind" AS ENUM ('EST_1RM', 'BEST_WEIGHT', 'BEST_VOLUME_SET', 'BEST_REPS', 'BEST_SESSION_VOLUME');

-- CreateTable
CREATE TABLE "Routine" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "goal" "Goal",
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "generatedFromPlan" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Routine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineItem" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "supersetGroup" INTEGER,
    "targetSets" INTEGER NOT NULL DEFAULT 3,
    "targetRepLow" INTEGER NOT NULL DEFAULT 8,
    "targetRepHigh" INTEGER NOT NULL DEFAULT 12,
    "targetRestSec" INTEGER NOT NULL DEFAULT 120,
    "targetRpe" DOUBLE PRECISION,
    "notes" TEXT,

    CONSTRAINT "RoutineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutSession" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "routineId" TEXT,
    "sourceSnapshot" JSONB,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "goal" "Goal",
    "name" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "bodyweightKg" DOUBLE PRECISION,
    "notes" TEXT,
    "restTimer" JSONB,

    CONSTRAINT "WorkoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionEntry" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "supersetGroup" INTEGER,
    "originRoutineItemId" TEXT,
    "targetSets" INTEGER NOT NULL DEFAULT 3,
    "targetRepLow" INTEGER NOT NULL DEFAULT 8,
    "targetRepHigh" INTEGER NOT NULL DEFAULT 12,
    "targetRestSec" INTEGER NOT NULL DEFAULT 120,
    "targetRpe" DOUBLE PRECISION,
    "isRemoved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SessionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetLog" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "setIndex" INTEGER NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "reps" INTEGER,
    "rpe" DOUBLE PRECISION,
    "rir" INTEGER,
    "isWarmup" BOOLEAN NOT NULL DEFAULT false,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SetLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalRecord" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "kind" "PrKind" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "setLogId" TEXT,
    "sessionId" TEXT,
    "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Routine_ownerId_idx" ON "Routine"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineItem_routineId_order_key" ON "RoutineItem"("routineId", "order");

-- CreateIndex
CREATE INDEX "WorkoutSession_ownerId_status_idx" ON "WorkoutSession"("ownerId", "status");

-- CreateIndex
CREATE INDEX "WorkoutSession_ownerId_startedAt_idx" ON "WorkoutSession"("ownerId", "startedAt");

-- CreateIndex
CREATE INDEX "SessionEntry_sessionId_idx" ON "SessionEntry"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionEntry_sessionId_order_key" ON "SessionEntry"("sessionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "SetLog_entryId_setIndex_key" ON "SetLog"("entryId", "setIndex");

-- CreateIndex
CREATE INDEX "PersonalRecord_ownerId_idx" ON "PersonalRecord"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalRecord_ownerId_exerciseId_kind_key" ON "PersonalRecord"("ownerId", "exerciseId", "kind");

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineItem" ADD CONSTRAINT "RoutineItem_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineItem" ADD CONSTRAINT "RoutineItem_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEntry" ADD CONSTRAINT "SessionEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEntry" ADD CONSTRAINT "SessionEntry_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetLog" ADD CONSTRAINT "SetLog_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "SessionEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalRecord" ADD CONSTRAINT "PersonalRecord_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalRecord" ADD CONSTRAINT "PersonalRecord_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
