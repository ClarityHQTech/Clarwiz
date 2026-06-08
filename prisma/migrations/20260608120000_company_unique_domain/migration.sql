-- Group companies by email domain; allow the same display name across different domains (e.g. example.com vs example.ai).
DROP INDEX IF EXISTS "Company_name_key";
CREATE UNIQUE INDEX "Company_domain_key" ON "Company"("domain");
