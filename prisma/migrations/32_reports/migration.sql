-- CreateTable
CREATE TABLE "ReportSettings" (
    "organizationId" TEXT NOT NULL,
    "daily" BOOLEAN NOT NULL DEFAULT false,
    "weekly" BOOLEAN NOT NULL DEFAULT true,
    "monthly" BOOLEAN NOT NULL DEFAULT true,
    "extraEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "alerts" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportSettings_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Report_organizationId_createdAt_idx" ON "Report"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Report_organizationId_kind_periodStart_key" ON "Report"("organizationId", "kind", "periodStart");

