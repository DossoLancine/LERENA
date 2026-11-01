-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "featuredUntil" TIMESTAMP(3),
ADD COLUMN     "smsCredits" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PlatformConfig" ADD COLUMN     "companyAddress" TEXT,
ADD COLUMN     "companyEmail" TEXT,
ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "companyPhone" TEXT,
ADD COLUMN     "companyRccm" TEXT,
ADD COLUMN     "companyTaxId" TEXT,
ADD COLUMN     "graceDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "invoicePrefix" TEXT NOT NULL DEFAULT 'LER',
ADD COLUMN     "paymentInstructions" TEXT,
ADD COLUMN     "paymentTermDays" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "taxRate" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trialDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "trialPlanId" TEXT,
ALTER COLUMN "appName" SET DEFAULT 'Lerena';

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "priceMonthly" INTEGER,
    "yearlyDiscountPct" INTEGER NOT NULL DEFAULT 15,
    "maxCounters" INTEGER,
    "maxServices" INTEGER,
    "maxTicketsMonth" INTEGER,
    "smsIncluded" INTEGER NOT NULL DEFAULT 0,
    "features" TEXT[],
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "highlight" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TRIAL',
    "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY',
    "customPricePerSite" INTEGER,
    "discountPct" INTEGER NOT NULL DEFAULT 0,
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "rentalMonthly" INTEGER,
    "smsQuantity" INTEGER,
    "featuredDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SUBSCRIPTION',
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "subtotal" INTEGER NOT NULL,
    "taxRate" INTEGER NOT NULL DEFAULT 0,
    "tax" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "lines" JSONB NOT NULL,
    "notes" TEXT,
    "appliedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsLedger" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_organizationId_key" ON "Subscription"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_issuedAt_idx" ON "Invoice"("organizationId", "issuedAt");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsLedger" ADD CONSTRAINT "SmsLedger_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Forfaits par défaut (prix et limites modifiables dans l'administration)
INSERT INTO "Plan" ("id","code","name","tagline","priceMonthly","yearlyDiscountPct","maxCounters","maxServices","maxTicketsMonth","smsIncluded","features","isPublic","isActive","highlight","sortOrder","updatedAt") VALUES
('plan_essentiel','essentiel','Essentiel','Pour démarrer : un site, une file simple',15000,15,3,5,1500,0,ARRAY['TV','KIOSK']::TEXT[],true,true,false,1,now()),
('plan_pro','pro','Pro','Le plus choisi : rendez-vous, SMS et statistiques',45000,15,10,NULL,NULL,200,ARRAY['TV','KIOSK','APPOINTMENTS','SMS_ALERTS','ANALYTICS','TV_ADS','MULTI_SITE']::TEXT[],true,true,true,2,now()),
('plan_entreprise','entreprise','Entreprise','Réseaux, ministères, banques : sur mesure',NULL,15,NULL,NULL,NULL,1000,ARRAY['TV','KIOSK','APPOINTMENTS','SMS_ALERTS','ANALYTICS','TV_ADS','MULTI_SITE','NETWORK','BRANDING','PRIORITY_SUPPORT']::TEXT[],true,true,false,3,now());

-- Catalogue par défaut
INSERT INTO "Product" ("id","kind","name","description","price","rentalMonthly","smsQuantity","featuredDays","isActive","sortOrder","updatedAt") VALUES
('prod_sms_500','SMS_PACK','Pack 500 SMS','Alertes « bientôt votre tour », rappels de rendez-vous',12500,NULL,500,NULL,true,1,now()),
('prod_sms_2000','SMS_PACK','Pack 2 000 SMS',NULL,45000,NULL,2000,NULL,true,2,now()),
('prod_sms_10000','SMS_PACK','Pack 10 000 SMS',NULL,200000,NULL,10000,NULL,true,3,now()),
('prod_feat_7','FEATURED','Mise en avant 7 jours','En tête de la recherche, badge « À la une »',5000,NULL,NULL,7,true,10,now()),
('prod_feat_30','FEATURED','Mise en avant 30 jours',NULL,15000,NULL,NULL,30,true,11,now()),
('prod_setup','SETUP','Installation et formation (1 site)','Déplacement, configuration des écrans et bornes, formation des agents',50000,NULL,NULL,NULL,true,20,now()),
('prod_tablet','HARDWARE','Borne tablette 10" + support','Pour la prise de tickets à l''entrée',120000,8000,NULL,NULL,true,30,now()),
('prod_tv','HARDWARE','Écran TV 43" + support mural','Affichage des appels en salle d''attente',250000,15000,NULL,NULL,true,31,now()),
('prod_box','HARDWARE','Boîtier Android TV','Transforme une TV existante en écran Lerena',35000,3000,NULL,NULL,true,32,now()),
('prod_printer','HARDWARE','Imprimante de tickets thermique',NULL,85000,6000,NULL,NULL,true,33,now());

UPDATE "PlatformConfig" SET "trialPlanId" = 'plan_pro';
