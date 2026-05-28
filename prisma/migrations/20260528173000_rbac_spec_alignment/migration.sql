-- Align RBAC schema to tenant-scoped roles + superadmin flag

-- User superadmin flag
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "is_superadmin" BOOLEAN NOT NULL DEFAULT false;
UPDATE "User" SET "is_superadmin" = true WHERE "platformRole" = 'SUPER_ADMIN';
ALTER TABLE "User" DROP COLUMN IF EXISTS "platformRole";

-- Tenant billing/activity fields
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "payment_status" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Tenant" SET "payment_status" = COALESCE("payment", false);
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "payment";
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "company_details" JSONB;

-- Normalize tenant role values
ALTER TYPE "TenantRole" RENAME TO "TenantRole_old";
CREATE TYPE "TenantRole" AS ENUM ('admin', 'member');

ALTER TABLE "TenantMembership"
  ALTER COLUMN "role" TYPE "TenantRole"
  USING (
    CASE
      WHEN "role"::text = 'TENANT_ADMIN' THEN 'admin'::"TenantRole"
      ELSE 'member'::"TenantRole"
    END
  );

ALTER TABLE "TenantInvitation"
  ALTER COLUMN "role" TYPE "TenantRole"
  USING (
    CASE
      WHEN "role"::text = 'TENANT_ADMIN' THEN 'admin'::"TenantRole"
      ELSE 'member'::"TenantRole"
    END
  );

DROP TYPE "TenantRole_old";

-- permissions -> scopes
ALTER TABLE "TenantMembership" RENAME COLUMN "permissions" TO "scopes";
ALTER TABLE "TenantInvitation" RENAME COLUMN "permissions" TO "scopes";

-- user_tenant_roles nomenclature
ALTER TABLE "TenantMembership" RENAME TO "user_tenant_roles";
ALTER TABLE "user_tenant_roles" RENAME COLUMN "tenantId" TO "tenant_id";
ALTER TABLE "user_tenant_roles" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "user_tenant_roles" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "user_tenant_roles" RENAME COLUMN "updatedAt" TO "updated_at";

-- Rebuild indexes/constraints with renamed columns/table
DROP INDEX IF EXISTS "TenantMembership_tenantId_userId_key";
DROP INDEX IF EXISTS "TenantMembership_userId_idx";
CREATE UNIQUE INDEX "user_tenant_roles_tenant_id_user_id_key" ON "user_tenant_roles"("tenant_id", "user_id");
CREATE INDEX "user_tenant_roles_user_id_idx" ON "user_tenant_roles"("user_id");

-- Constraint names + enum cleanup (moved from 20260528115849_rbac)
ALTER TABLE "user_tenant_roles" RENAME CONSTRAINT "TenantMembership_pkey" TO "user_tenant_roles_pkey";
ALTER TABLE "user_tenant_roles" RENAME CONSTRAINT "TenantMembership_tenantId_fkey" TO "user_tenant_roles_tenant_id_fkey";
ALTER TABLE "user_tenant_roles" RENAME CONSTRAINT "TenantMembership_userId_fkey" TO "user_tenant_roles_user_id_fkey";
DROP TYPE IF EXISTS "PlatformRole";
