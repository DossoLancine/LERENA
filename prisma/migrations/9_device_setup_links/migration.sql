-- CreateTable
CREATE TABLE "DeviceSetupLink" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "deviceId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceSetupLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceSetupLink_tokenHash_key" ON "DeviceSetupLink"("tokenHash");

-- CreateIndex
CREATE INDEX "DeviceSetupLink_organizationId_createdAt_idx" ON "DeviceSetupLink"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "DeviceSetupLink" ADD CONSTRAINT "DeviceSetupLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

