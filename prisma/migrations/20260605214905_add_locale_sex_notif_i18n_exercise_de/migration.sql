-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('FEMALE', 'MALE', 'UNSPECIFIED');

-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "instructionsDe" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "nameDe" TEXT;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "bodyKey" TEXT,
ADD COLUMN     "params" JSONB,
ADD COLUMN     "titleKey" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "sex" "Sex" NOT NULL DEFAULT 'UNSPECIFIED';
