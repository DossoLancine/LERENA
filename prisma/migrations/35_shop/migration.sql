-- CreateTable
CREATE TABLE "ShopProduct" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PHYSICAL',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "price" INTEGER NOT NULL DEFAULT 0,
    "compareAtPrice" INTEGER,
    "stock" INTEGER,
    "lowStockAt" INTEGER,
    "branchIds" TEXT[],
    "serviceIds" TEXT[],
    "moments" TEXT[],
    "digitalContent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "adds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "total" INTEGER NOT NULL,
    "moment" TEXT NOT NULL,
    "ticketId" TEXT,
    "appointmentId" TEXT,
    "customerId" TEXT,
    "userId" TEXT,
    "paymentMethod" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedReason" TEXT,
    "digitalSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "ShopOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopOrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "actorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopOrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopProduct_organizationId_isActive_idx" ON "ShopProduct"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "ShopOrder_organizationId_status_createdAt_idx" ON "ShopOrder"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ShopOrder_ticketId_idx" ON "ShopOrder"("ticketId");

-- CreateIndex
CREATE INDEX "ShopOrder_appointmentId_idx" ON "ShopOrder"("appointmentId");

-- CreateIndex
CREATE INDEX "ShopOrder_customerId_idx" ON "ShopOrder"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopOrder_organizationId_number_key" ON "ShopOrder"("organizationId", "number");

-- CreateIndex
CREATE INDEX "ShopOrderItem_productId_idx" ON "ShopOrderItem"("productId");

-- CreateIndex
CREATE INDEX "ShopOrderEvent_orderId_idx" ON "ShopOrderEvent"("orderId");

-- AddForeignKey
ALTER TABLE "ShopProduct" ADD CONSTRAINT "ShopProduct_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrder" ADD CONSTRAINT "ShopOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrder" ADD CONSTRAINT "ShopOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrder" ADD CONSTRAINT "ShopOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrderItem" ADD CONSTRAINT "ShopOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShopOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrderItem" ADD CONSTRAINT "ShopOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrderEvent" ADD CONSTRAINT "ShopOrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShopOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Reprise des anciennes promotions dans la boutique (affichées pendant l'attente, comme avant)
INSERT INTO "ShopProduct" ("id", "organizationId", "type", "name", "description", "imageUrl", "price", "moments", "isActive", "adds", "createdAt", "updatedAt")
SELECT 'promo_' || p."id", p."organizationId", 'SERVICE', p."title", p."description", p."imageUrl",
       COALESCE(NULLIF(regexp_replace(COALESCE(p."price", ''), '[^0-9]', '', 'g'), '')::int, 0),
       ARRAY['WAITING']::text[], p."isActive", p."claimsCount", p."createdAt", CURRENT_TIMESTAMP
FROM "Promotion" p
ON CONFLICT ("id") DO NOTHING;

-- Boutique sans limite de produits : forfaits Pro et Entreprise (Essentiel : 10 produits actifs)
UPDATE "Plan" SET "features" = array_append("features", 'SHOP_UNLIMITED') WHERE "code" IN ('pro', 'entreprise') AND NOT ('SHOP_UNLIMITED' = ANY("features"));
