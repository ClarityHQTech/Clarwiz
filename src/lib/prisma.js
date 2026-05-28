import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

function createPrismaClient() {
  return new PrismaClient();
}

// In dev, Next.js keeps a hot-reloaded Prisma singleton that can go stale after
// `prisma migrate` / `prisma generate`. Bump this when Prospect schema changes.
const PRISMA_DEV_CACHE_KEY = "prisma_v6_external_api_keys";

export const prisma =
  process.env.NODE_ENV === "production"
    ? globalForPrisma.prisma ?? createPrismaClient()
    : globalForPrisma[PRISMA_DEV_CACHE_KEY] ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma[PRISMA_DEV_CACHE_KEY] = prisma;
}
