-- DropIndex (encrypted values are not looked up by account id)
DROP INDEX IF EXISTS "LinkedInIntegration_linkupAccountId_idx";
