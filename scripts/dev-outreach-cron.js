/**
 * Dev-only: hits /api/cron/outreach every 60s. Run alongside `npm run dev`.
 * Uses SECRET and NEXT_PUBLIC_URL from .env (load via your shell or dotenv).
 * Usage: npm run cron:outreach
 */
const base = process.env.NEXT_PUBLIC_URL?.trim() || "http://localhost:3000";
const secret =
  process.env.SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();

if (!secret) {
  console.error("Set SECRET (or NEXTAUTH_SECRET) in .env");
  process.exit(1);
}

async function tick() {
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/cron/outreach`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
    });
    const data = await res.json().catch(() => ({}));
    console.log(
      `[outreach-cron] ${res.status}`,
      data.scheduledProspects ?? 0,
      "sent,",
      data.retries ?? 0,
      "retries"
    );
  } catch (err) {
    console.error("[outreach-cron]", err.message);
  }
}

console.log(`Outreach cron → ${base}/api/cron/outreach (every 60s, auth via SECRET)`);
tick();
setInterval(tick, 60_000);
