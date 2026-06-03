-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "BoardKind" AS ENUM ('WEEKLY_XP', 'ALLTIME_XP', 'STREAK', 'VOLUME', 'PR');

-- AlterTable
ALTER TABLE "PrivacySettings" ADD COLUMN     "showPhotos" "Visibility" NOT NULL DEFAULT 'FRIENDS';

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "impersonatorId" TEXT;

-- AlterTable
ALTER TABLE "SessionEntry" ADD COLUMN     "targetLoadKg" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "defaultEquipment" "Equipment"[] DEFAULT ARRAY[]::"Equipment"[],
ADD COLUMN     "experienceLevel" "ExperienceLevel",
ADD COLUMN     "onboardedAt" TIMESTAMP(3),
ADD COLUMN     "primaryGoal" "Goal",
ADD COLUMN     "trainingDaysPerWeek" INTEGER;

-- CreateTable
CREATE TABLE "LeaderboardSnapshot" (
    "id" TEXT NOT NULL,
    "board" "BoardKind" NOT NULL,
    "weekKey" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "builtAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderboardSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteLink" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "maxUses" INTEGER,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeaderboardSnapshot_board_weekKey_idx" ON "LeaderboardSnapshot"("board", "weekKey");

-- CreateIndex
CREATE INDEX "LeaderboardSnapshot_userId_idx" ON "LeaderboardSnapshot"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardSnapshot_board_weekKey_rank_key" ON "LeaderboardSnapshot"("board", "weekKey", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "InviteLink_code_key" ON "InviteLink"("code");

-- CreateIndex
CREATE INDEX "InviteLink_creatorId_idx" ON "InviteLink"("creatorId");

-- AddForeignKey
ALTER TABLE "LeaderboardSnapshot" ADD CONSTRAINT "LeaderboardSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteLink" ADD CONSTRAINT "InviteLink_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
