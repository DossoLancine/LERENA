-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "sectorId" TEXT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "icon" TEXT;

-- CreateTable
CREATE TABLE "Sector" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT NOT NULL DEFAULT 'building',
    "color" TEXT NOT NULL DEFAULT 'orange',
    "services" JSONB NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "appName" TEXT NOT NULL DEFAULT 'ATTENDS',
    "defaultCountryCode" TEXT NOT NULL DEFAULT '+225',
    "defaultCity" TEXT,
    "defaultLat" DOUBLE PRECISION,
    "defaultLng" DOUBLE PRECISION,
    "demoMode" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sector_slug_key" ON "Sector"("slug");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Données initiales : secteurs et services types (modifiables ensuite dans /admin)
-- ---------------------------------------------------------------------------
INSERT INTO "Sector" ("id", "slug", "name", "description", "icon", "color", "services", "sortOrder", "updatedAt") VALUES
(md5('sector-sante'), 'sante', 'Santé', 'Hôpitaux, cliniques, cabinets médicaux', 'stethoscope', 'blue',
 '[{"name":"Accueil & orientation","durationMin":5,"prefix":"A","icon":"clipboard"},{"name":"Consultation générale","durationMin":20,"prefix":"C","icon":"stethoscope"},{"name":"Pédiatrie","durationMin":15,"prefix":"P","icon":"baby"},{"name":"Urgences","durationMin":10,"prefix":"U","icon":"siren"},{"name":"Caisse","durationMin":5,"prefix":"K","icon":"banknote"},{"name":"Pharmacie","durationMin":5,"prefix":"F","icon":"pill"}]'::jsonb, 10, CURRENT_TIMESTAMP),
(md5('sector-pharmacie'), 'pharmacie', 'Pharmacie', 'Officines et parapharmacies', 'pill', 'green',
 '[{"name":"Délivrance d''ordonnance","durationMin":5,"prefix":"O","icon":"pill"},{"name":"Conseil","durationMin":5,"prefix":"C","icon":"message"}]'::jsonb, 20, CURRENT_TIMESTAMP),
(md5('sector-banque'), 'banque', 'Banque & microfinance', 'Agences bancaires et institutions de microfinance', 'landmark', 'gray',
 '[{"name":"Retraits & dépôts","durationMin":5,"prefix":"R","icon":"banknote"},{"name":"Ouverture de compte","durationMin":30,"prefix":"O","icon":"user-plus"},{"name":"Crédit","durationMin":30,"prefix":"C","icon":"wallet"},{"name":"Service client","durationMin":10,"prefix":"S","icon":"message"}]'::jsonb, 30, CURRENT_TIMESTAMP),
(md5('sector-administration'), 'administration', 'Administration publique', 'Mairies, préfectures, état civil, identification', 'building', 'purple',
 '[{"name":"État civil","durationMin":10,"prefix":"E","icon":"file-text"},{"name":"Légalisation","durationMin":5,"prefix":"L","icon":"stamp"},{"name":"Carte d''identité & passeport","durationMin":20,"prefix":"I","icon":"id-card"},{"name":"Information","durationMin":5,"prefix":"N","icon":"info"}]'::jsonb, 40, CURRENT_TIMESTAMP),
(md5('sector-telecom'), 'telecom-energie', 'Télécoms & énergie', 'Opérateurs mobiles, eau, électricité', 'smartphone', 'teal',
 '[{"name":"Abonnement & SIM","durationMin":10,"prefix":"A","icon":"smartphone"},{"name":"Réclamation","durationMin":15,"prefix":"R","icon":"message"},{"name":"Paiement de facture","durationMin":5,"prefix":"P","icon":"banknote"}]'::jsonb, 50, CURRENT_TIMESTAMP),
(md5('sector-education'), 'education', 'Éducation', 'Universités, écoles, centres d''examen', 'graduation-cap', 'orange',
 '[{"name":"Inscription","durationMin":15,"prefix":"I","icon":"file-text"},{"name":"Scolarité & attestations","durationMin":10,"prefix":"S","icon":"graduation-cap"},{"name":"Bourses","durationMin":15,"prefix":"B","icon":"wallet"}]'::jsonb, 60, CURRENT_TIMESTAMP),
(md5('sector-transport'), 'transport', 'Transport', 'Gares routières, compagnies, permis de conduire', 'bus', 'red',
 '[{"name":"Billetterie","durationMin":5,"prefix":"B","icon":"ticket"},{"name":"Bagages & colis","durationMin":10,"prefix":"C","icon":"package"}]'::jsonb, 70, CURRENT_TIMESTAMP),
(md5('sector-restauration'), 'restauration', 'Restauration', 'Restaurants et services de restauration rapide', 'utensils', 'orange',
 '[{"name":"Commande","durationMin":5,"prefix":"C","icon":"utensils"},{"name":"Retrait","durationMin":3,"prefix":"R","icon":"package"}]'::jsonb, 80, CURRENT_TIMESTAMP),
(md5('sector-beaute'), 'beaute', 'Beauté & bien-être', 'Salons de coiffure, instituts', 'scissors', 'pink',
 '[{"name":"Coiffure","durationMin":30,"prefix":"C","icon":"scissors"},{"name":"Soins","durationMin":45,"prefix":"S","icon":"sparkles"}]'::jsonb, 90, CURRENT_TIMESTAMP),
(md5('sector-autre'), 'autre', 'Autre service', 'Tout autre établissement recevant du public', 'store', 'gray',
 '[{"name":"Accueil","durationMin":10,"prefix":"A","icon":"ticket"}]'::jsonb, 100, CURRENT_TIMESTAMP);

-- Établissements existants rattachés à leur secteur d'après leur catégorie actuelle
UPDATE "Organization" o SET "sectorId" = s."id"
FROM "Sector" s
WHERE o."sectorId" IS NULL AND (
  (o."category" = 'Santé' AND s."slug" = 'sante') OR
  (o."category" = 'Pharmacie' AND s."slug" = 'pharmacie') OR
  (o."category" = 'Banque' AND s."slug" = 'banque') OR
  (o."category" = 'Administration' AND s."slug" = 'administration') OR
  (o."category" = 'Télécom' AND s."slug" = 'telecom-energie') OR
  (o."category" = 'Restauration' AND s."slug" = 'restauration') OR
  (o."category" = 'Beauté' AND s."slug" = 'beaute')
);
UPDATE "Organization" o SET "sectorId" = md5('sector-autre') WHERE o."sectorId" IS NULL;
-- La catégorie affichée reprend le nom du secteur
UPDATE "Organization" o SET "category" = s."name" FROM "Sector" s WHERE o."sectorId" = s."id";

-- Réglages de la plateforme : Côte d'Ivoire par défaut, mode démo actif tant que la plateforme est en démonstration
INSERT INTO "PlatformConfig" ("id", "appName", "defaultCountryCode", "defaultCity", "defaultLat", "defaultLng", "demoMode", "updatedAt")
VALUES ('default', 'ATTENDS', '+225', 'Abidjan', 5.320357, -4.016107, true, CURRENT_TIMESTAMP);
