-- CreateEnum
CREATE TYPE "Muscle" AS ENUM ('CHEST', 'FRONT_DELTS', 'SIDE_DELTS', 'REAR_DELTS', 'BICEPS', 'TRICEPS', 'FOREARMS', 'LATS', 'TRAPS', 'RHOMBOIDS', 'LOWER_BACK', 'ABS', 'OBLIQUES', 'QUADS', 'HAMSTRINGS', 'GLUTES', 'CALVES', 'ADDUCTORS', 'NECK');

-- CreateEnum
CREATE TYPE "Equipment" AS ENUM ('BARBELL', 'DUMBBELL', 'MACHINE', 'CABLE', 'BODYWEIGHT', 'KETTLEBELL', 'BAND', 'EZ_BAR', 'BALL', 'OTHER');

-- CreateEnum
CREATE TYPE "ExCategory" AS ENUM ('STRENGTH', 'CARDIO', 'OLYMPIC', 'PLYOMETRICS', 'POWERLIFTING', 'STRETCHING', 'STRONGMAN', 'OTHER');

-- CreateEnum
CREATE TYPE "Mechanic" AS ENUM ('COMPOUND', 'ISOLATION');

-- CreateEnum
CREATE TYPE "Force" AS ENUM ('PUSH', 'PULL', 'STATIC');

-- CreateEnum
CREATE TYPE "MuscleRole" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ExCategory" NOT NULL DEFAULT 'STRENGTH',
    "equipment" "Equipment" NOT NULL DEFAULT 'OTHER',
    "mechanic" "Mechanic",
    "force" "Force",
    "level" TEXT,
    "instructions" TEXT[],
    "iconKey" TEXT NOT NULL DEFAULT 'dumbbell',
    "defaultSets" INTEGER NOT NULL DEFAULT 3,
    "defaultRepLow" INTEGER NOT NULL DEFAULT 8,
    "defaultRepHigh" INTEGER NOT NULL DEFAULT 12,
    "defaultRestSec" INTEGER NOT NULL DEFAULT 120,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'FREE_EXERCISE_DB',
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseMuscle" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "muscle" "Muscle" NOT NULL,
    "role" "MuscleRole" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ExerciseMuscle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_sourceId_key" ON "Exercise"("sourceId");

-- CreateIndex
CREATE INDEX "Exercise_ownerId_idx" ON "Exercise"("ownerId");

-- CreateIndex
CREATE INDEX "Exercise_name_idx" ON "Exercise"("name");

-- CreateIndex
CREATE INDEX "Exercise_equipment_idx" ON "Exercise"("equipment");

-- CreateIndex
CREATE INDEX "ExerciseMuscle_muscle_idx" ON "ExerciseMuscle"("muscle");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseMuscle_exerciseId_muscle_key" ON "ExerciseMuscle"("exerciseId", "muscle");

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseMuscle" ADD CONSTRAINT "ExerciseMuscle_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
