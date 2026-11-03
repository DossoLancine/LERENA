-- CreateTable
CREATE TABLE "AiInsight" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "model" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiInsight_organizationId_scopeKey_createdAt_idx" ON "AiInsight"("organizationId", "scopeKey", "createdAt");

