-- Support GOD tabs: priority, assignment, SLA, templates, attachments

CREATE TYPE "SupportPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

ALTER TABLE "SupportTicket" ADD COLUMN "priority" "SupportPriority" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "SupportTicket" ADD COLUMN "assigneeId" TEXT;
ALTER TABLE "SupportTicket" ADD COLUMN "slaDueAt" TIMESTAMP(3);
ALTER TABLE "SupportTicket" ADD COLUMN "slaNotifiedAt" TIMESTAMP(3);
ALTER TABLE "SupportTicket" ADD COLUMN "firstResponseAt" TIMESTAMP(3);

-- Backfill SLA: existing OPEN/PENDING tickets get 24h window from creation
UPDATE "SupportTicket" SET "slaDueAt" = "createdAt" + INTERVAL '24 hours' WHERE "slaDueAt" IS NULL;

ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SupportTicket_assigneeId_status_idx" ON "SupportTicket"("assigneeId", "status");
CREATE INDEX "SupportTicket_priority_status_idx" ON "SupportTicket"("priority", "status");
CREATE INDEX "SupportTicket_slaDueAt_idx" ON "SupportTicket"("slaDueAt");

CREATE TABLE "SupportTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'ru',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupportTemplate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupportTemplate_locale_createdAt_idx" ON "SupportTemplate"("locale", "createdAt");
ALTER TABLE "SupportTemplate" ADD CONSTRAINT "SupportTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SupportAttachment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "replyId" TEXT,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportAttachment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupportAttachment_ticketId_createdAt_idx" ON "SupportAttachment"("ticketId", "createdAt");
CREATE INDEX "SupportAttachment_replyId_idx" ON "SupportAttachment"("replyId");
ALTER TABLE "SupportAttachment" ADD CONSTRAINT "SupportAttachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportAttachment" ADD CONSTRAINT "SupportAttachment_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "SupportReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportAttachment" ADD CONSTRAINT "SupportAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
