import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleInteraktWhatsAppWebhook } from "@/lib/execution/whatsappWebhookHandlers";

/**
 * Interakt webhook receiver for template status and incoming messages.
 * Configure: {NEXT_PUBLIC_URL}/api/integrations/whatsapp/interakt/webhook
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const secret = process.env.INTERAKT_WEBHOOK_SECRET?.trim();
  const headerSecret =
    request.headers.get("x-interakt-signature") ||
    request.headers.get("x-webhook-secret");

  if (secret && headerSecret && headerSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId =
    process.env.WHATSAPP_WEBHOOK_DEFAULT_TENANT_ID?.trim() ||
    process.env.WHATSAPP_WEBHOOK_DEFAULT_USER_ID?.trim() ||
    (await prisma.whatsAppIntegration.findFirst({
      where: { mode: "interakt", status: "connected" },
      select: { tenantId: true },
      orderBy: { updatedAt: "desc" },
    }))?.tenantId;

  if (!tenantId) {
    return NextResponse.json({ received: true });
  }

  try {
    const processed = await handleInteraktWhatsAppWebhook(tenantId, body);
    const inbound = processed.filter((p) => p.activity === "reply");
    if (inbound.length) {
      console.info(
        "[interakt/webhook] Stored inbound message(s)",
        inbound.map((p) => p.commLogId)
      );
    }
    return NextResponse.json({ received: true, processed });
  } catch (err) {
    console.error("[interakt/webhook]", err);
    return NextResponse.json({ received: true, error: err.message });
  }
}
