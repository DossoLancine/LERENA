-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "visitorPriorityApp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "visitorPriorityKiosk" BOOLEAN NOT NULL DEFAULT false;

