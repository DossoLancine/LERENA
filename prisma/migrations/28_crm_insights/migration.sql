-- CreateTable
CREATE TABLE "CustomerDuplicateIgnore" (
    "organizationId" TEXT NOT NULL,
    "customerA" TEXT NOT NULL,
    "customerB" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerDuplicateIgnore_pkey" PRIMARY KEY ("organizationId","customerA","customerB")
);


-- Pilotage, import et export des visiteurs : inclus dans les forfaits Pro et Entreprise
UPDATE "Plan" SET "features" = array_append("features", 'CRM_INSIGHTS') WHERE "code" IN ('pro', 'entreprise') AND NOT ('CRM_INSIGHTS' = ANY("features"));
