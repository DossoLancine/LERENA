-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "priorityReason" TEXT;

-- CreateTable
CREATE TABLE "PriorityCategory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 2,
    "selfService" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriorityCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriorityCategory_organizationId_idx" ON "PriorityCategory"("organizationId");

-- AddForeignKey
ALTER TABLE "PriorityCategory" ADD CONSTRAINT "PriorityCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Motifs de départ pour chaque établissement existant (modifiables dans Paramètres → Priorités)
INSERT INTO "PriorityCategory" ("id", "organizationId", "label", "level", "selfService", "sortOrder")
SELECT md5(o."id" || '-' || d.label), o."id", d.label, d.level, d.self, d.sort
FROM "Organization" o
CROSS JOIN (VALUES
  ('Personne en situation de handicap', 2, true, 1),
  ('Femme enceinte', 2, true, 2),
  ('Personne âgée', 2, true, 3),
  ('Urgence', 3, false, 4)
) AS d(label, level, self, sort);
