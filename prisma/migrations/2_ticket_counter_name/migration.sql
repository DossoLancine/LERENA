-- Le guichet appelant était caché dans guestPhone (« G-<guichet> ») : il a maintenant sa colonne
ALTER TABLE "Ticket" ADD COLUMN "counterName" TEXT;

UPDATE "Ticket"
SET "counterName" = substring("guestPhone" from 3),
    "guestPhone" = NULL
WHERE "guestPhone" LIKE 'G-%';
