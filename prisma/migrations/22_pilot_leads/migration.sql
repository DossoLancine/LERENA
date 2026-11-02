-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "pilotBaselineDaily" INTEGER,
ADD COLUMN     "pilotBaselineWaitMin" INTEGER,
ADD COLUMN     "pilotNotes" TEXT,
ADD COLUMN     "pilotStartedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "sector" TEXT,
    "city" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "sites" INTEGER,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_status_createdAt_idx" ON "Lead"("status", "createdAt");

