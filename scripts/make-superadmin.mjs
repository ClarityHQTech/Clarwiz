/**
 * Make a Clarwiz user a super-admin and (if present) grant ADMIN on the
 * "MOFU Demo" tenant so the synced data is visible.
 *
 *   node scripts/make-superadmin.mjs <email>
 *
 * The user row must already exist — sign in once with Google first (NextAuth
 * creates it; pre-creating it here would collide with the unique-email
 * constraint on the next sign-in).
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

// Load DATABASE_URL from .env (node doesn't auto-load it).
try {
  const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
} catch {
  /* fall back to ambient env */
}

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("usage: node scripts/make-superadmin.mjs <email>");
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log(
      `[make-superadmin] No user row for "${email}" yet.\n` +
        `  → Start the app (npm run dev), sign in once with Google using that email,\n` +
        `    then re-run:  node scripts/make-superadmin.mjs ${email}`
    );
    process.exit(0);
  }

  await prisma.user.update({ where: { id: user.id }, data: { is_superadmin: true } });
  console.log(`[make-superadmin] ✓ "${email}" is now a super-admin.`);

  const tenant = await prisma.tenant.findFirst({ where: { name: "MOFU Demo" } });
  if (tenant) {
    await prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
      create: { tenantId: tenant.id, userId: user.id, role: "ADMIN", scopes: [] },
      update: { role: "ADMIN" },
    });
    console.log(`[make-superadmin] ✓ ADMIN membership on "MOFU Demo" (${tenant.id}).`);
  } else {
    console.log(
      `[make-superadmin] (No "MOFU Demo" tenant — run \`node scripts/seed-mofu-demo.js\` to load the synced sandbox data.)`
    );
  }
} finally {
  await prisma.$disconnect();
}
