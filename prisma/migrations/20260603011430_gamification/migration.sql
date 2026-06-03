-- CreateEnum
CREATE TYPE "XpEventType" AS ENUM ('SET', 'PR', 'WORKOUT_COMPLETE', 'STREAK_DAY', 'VOLUME_MILESTONE', 'FRIEND_STREAK_BONUS');

-- CreateEnum
CREATE TYPE "LeagueOutcome" AS ENUM ('PROMOTE', 'HOLD', 'RELEGATE');

-- CreateEnum
CREATE TYPE "CohortStatus" AS ENUM ('ACTIVE', 'SETTLED');

-- CreateEnum
CREATE TYPE "NotifKind" AS ENUM ('STREAK_RISK', 'LEAGUE_RESULT', 'FRIEND_REQUEST', 'FRIEND_PR', 'WEEKLY_RECAP', 'LEVEL_UP');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('RUNNING', 'OK', 'FAILED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- CreateTable
CREATE TABLE "XpEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "XpEventType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "rawAmount" INTEGER NOT NULL,
    "workoutId" TEXT,
    "meta" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dayKey" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStats" (
    "userId" TEXT NOT NULL,
    "lifetimeXp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDay" TEXT,
    "freezesAvail" INTEGER NOT NULL DEFAULT 0,
    "totalVolume" BIGINT NOT NULL DEFAULT 0,
    "totalSessions" INTEGER NOT NULL DEFAULT 0,
    "leagueTier" TEXT NOT NULL DEFAULT 'BRONZE',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStats_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "LeagueCohort" (
    "id" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "status" "CohortStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeagueCohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueMembership" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weeklyXp" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "outcome" "LeagueOutcome",

    CONSTRAINT "LeagueMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "NotifKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "detail" JSONB,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "XpEvent_userId_dayKey_idx" ON "XpEvent"("userId", "dayKey");

-- CreateIndex
CREATE INDEX "XpEvent_userId_weekKey_idx" ON "XpEvent"("userId", "weekKey");

-- CreateIndex
CREATE INDEX "XpEvent_weekKey_idx" ON "XpEvent"("weekKey");

-- CreateIndex
CREATE INDEX "UserStats_lifetimeXp_idx" ON "UserStats"("lifetimeXp");

-- CreateIndex
CREATE INDEX "UserStats_longestStreak_idx" ON "UserStats"("longestStreak");

-- CreateIndex
CREATE INDEX "LeagueCohort_weekKey_status_idx" ON "LeagueCohort"("weekKey", "status");

-- CreateIndex
CREATE INDEX "LeagueCohort_tier_weekKey_status_idx" ON "LeagueCohort"("tier", "weekKey", "status");

-- CreateIndex
CREATE INDEX "LeagueMembership_cohortId_weeklyXp_idx" ON "LeagueMembership"("cohortId", "weeklyXp");

-- CreateIndex
CREATE INDEX "LeagueMembership_userId_idx" ON "LeagueMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueMembership_cohortId_userId_key" ON "LeagueMembership"("cohortId", "userId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobRun_job_periodKey_key" ON "JobRun"("job", "periodKey");

-- AddForeignKey
ALTER TABLE "XpEvent" ADD CONSTRAINT "XpEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStats" ADD CONSTRAINT "UserStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMembership" ADD CONSTRAINT "LeagueMembership_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "LeagueCohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMembership" ADD CONSTRAINT "LeagueMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
