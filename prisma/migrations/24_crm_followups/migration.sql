-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "noShowSmsAt" TIMESTAMP(3),
ADD COLUMN     "seriesId" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "apptNoShowSms" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "CustomerFollowUp" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "assignedToId" TEXT,
    "assignedToName" TEXT,
    "smsReminder" BOOLEAN NOT NULL DEFAULT false,
    "smsSentAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "doneAt" TIMESTAMP(3),
    "doneByName" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerFollowUp_organizationId_status_dueDate_idx" ON "CustomerFollowUp"("organizationId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "CustomerFollowUp_customerId_idx" ON "CustomerFollowUp"("customerId");

-- AddForeignKey
ALTER TABLE "CustomerFollowUp" ADD CONSTRAINT "CustomerFollowUp_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerFollowUp" ADD CONSTRAINT "CustomerFollowUp_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Suivis et relances des visiteurs : inclus dans les forfaits Pro et Entreprise
UPDATE "Plan" SET "features" = array_append("features", 'CRM_FOLLOWUPS') WHERE "code" IN ('pro', 'entreprise') AND NOT ('CRM_FOLLOWUPS' = ANY("features"));
