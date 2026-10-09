CREATE TABLE IF NOT EXISTS "SupportReply" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportReply_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SupportReply_ticketId_createdAt_idx" ON "SupportReply"("ticketId", "createdAt");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SupportReply_ticketId_fkey') THEN
    ALTER TABLE "SupportReply" ADD CONSTRAINT "SupportReply_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "OperatorSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OperatorSetting_pkey" PRIMARY KEY ("key")
);

-- Bootstrap only an already-verified account. Never create credentials or mark
-- an unverified registration as verified during a deployment.
UPDATE "User" SET "role" = 'SUPPORT', "updatedAt" = CURRENT_TIMESTAMP
WHERE lower("email") = 'romangulanyan@gmail.com' AND "emailVerified" = true AND "role" <> 'ADMIN';
