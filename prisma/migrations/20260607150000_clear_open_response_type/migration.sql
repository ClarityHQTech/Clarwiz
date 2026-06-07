-- Opens were incorrectly stored as responseType = 'open', inflating reply metrics.
UPDATE "CommunicationLog"
SET "responseType" = NULL
WHERE "responseType" = 'open';
