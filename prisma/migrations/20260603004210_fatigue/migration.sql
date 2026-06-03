-- CreateTable
CREATE TABLE "SorenessReport" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "muscle" "Muscle" NOT NULL,
    "severity" INTEGER NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SorenessReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuscleFatigueSnapshot" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "muscle" "Muscle" NOT NULL,
    "fatigue" DOUBLE PRECISION NOT NULL,
    "recoveryEtaAt" TIMESTAMP(3),
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MuscleFatigueSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SorenessReport_ownerId_reportedAt_idx" ON "SorenessReport"("ownerId", "reportedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MuscleFatigueSnapshot_ownerId_muscle_key" ON "MuscleFatigueSnapshot"("ownerId", "muscle");

-- AddForeignKey
ALTER TABLE "SorenessReport" ADD CONSTRAINT "SorenessReport_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MuscleFatigueSnapshot" ADD CONSTRAINT "MuscleFatigueSnapshot_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
