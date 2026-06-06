import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleHubSpotWebhook } from "@/lib/mofu/hubspotWebhook";
import { recomputeDeal } from "@/lib/mofu/recompute";

// POST /api/webhooks/hubspot/:token — per-tenant token (IntegrationWebhook). Bad/missing
// token -> 401. Returns 200 fast; ingests signals and re-triggers the brain.
export async function POST(request, { params }) {
  const raw = await request.text();
  const record = await prisma.integrationWebhook.findUnique({ where: { webhookToken: params.token } });
  if (!record || record.provider !== "hubspot" || record.status === "revoked") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(raw || "[]");
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const events = Array.isArray(payload) ? payload : payload.events ?? [payload];

  const out = await handleHubSpotWebhook(
    { tenantId: record.tenantId, events },
    { recompute: (a) => recomputeDeal(a) }
  );
  return NextResponse.json({ ok: true, ...out });
}
