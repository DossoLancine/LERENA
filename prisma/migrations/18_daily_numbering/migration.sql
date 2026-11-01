-- AlterTable
ALTER TABLE "Queue" ADD COLUMN     "numDay" TEXT;


-- La numérotation en cours est celle du jour du déploiement
UPDATE "Queue" SET "numDay" = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
