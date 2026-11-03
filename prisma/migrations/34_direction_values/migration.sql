-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "targetSatisfaction" DOUBLE PRECISION,
ADD COLUMN     "targetWaitMin" INTEGER;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "defaultVisitValue" INTEGER;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "visitValue" INTEGER;

