-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "smsTurnAlerts" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OutboundMessage" ADD COLUMN     "ticketId" TEXT;

