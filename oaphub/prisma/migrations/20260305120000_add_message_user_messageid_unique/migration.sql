-- De-duplicate existing rows before adding unique index.
-- Keep the earliest row for each (userId, messageId) pair.
WITH ranked_messages AS (
    SELECT
        ctid,
        ROW_NUMBER() OVER (
            PARTITION BY "userId", "messageId"
            ORDER BY "createdAt" ASC, "id" ASC
        ) AS rn
    FROM "Message"
    WHERE "messageId" IS NOT NULL
)
DELETE FROM "Message" m
USING ranked_messages r
WHERE m.ctid = r.ctid
  AND r.rn > 1;

-- Enforce idempotent sync semantics per user.
CREATE UNIQUE INDEX "Message_userId_messageId_key"
ON "Message"("userId", "messageId");
