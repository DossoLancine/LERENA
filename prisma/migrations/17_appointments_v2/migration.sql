-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "code" TEXT,
ADD COLUMN     "manageTokenHash" TEXT,
ADD COLUMN     "reminderDayAt" TIMESTAMP(3),
ADD COLUMN     "reminderHourAt" TIMESTAMP(3),
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'APP',
ADD COLUMN     "ticketId" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "apptCancelHours" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "apptMaxActive" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "apptNoShowBlock" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "apptNoShowGraceMin" INTEGER NOT NULL DEFAULT 15;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "apptCapacity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "apptHorizonDays" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "apptLeadMin" INTEGER NOT NULL DEFAULT 60;

-- CreateTable
CREATE TABLE "ClosureDay" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClosureDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClosureDay_organizationId_date_idx" ON "ClosureDay"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_code_key" ON "Appointment"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_manageTokenHash_key" ON "Appointment"("manageTokenHash");

-- AddForeignKey
ALTER TABLE "ClosureDay" ADD CONSTRAINT "ClosureDay_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

