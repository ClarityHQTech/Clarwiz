/**
 * Dev-only: hits /api/cron/mofu-collateral every 30s to process queued Path B
 * sales-collateral jobs. Run alongside `npm run dev`.
 * Usage: npm run cron:collateral
 */
const base = process.env.NEXT_PUBLIC_URL?.trim() || "http://localhost:3000";
const secret = process.env.SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();

if (!secret) {
  console.error("Set SECRET (or NEXTAUTH_SECRET) in .env");
  process.exit(1);
}

async function tick() {
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/cron/mofu-collateral`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    console.log(`[collateral-cron] ${res.status}`, data.processed ?? 0, "processed,", data.failed ?? 0, "failed");
  } catch (err) {
    console.error("[collateral-cron]", err.message);
  }
}

console.log(`Collateral cron → ${base}/api/cron/mofu-collateral (every 30s)`);
tick();
setInterval(tick, 30_000);
