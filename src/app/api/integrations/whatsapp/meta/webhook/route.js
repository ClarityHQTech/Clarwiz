import { NextResponse } from "next/server";
import {
  handleMetaWhatsAppWebhook,
  resolveWhatsAppWebhookUserId,
} from "@/lib/execution/whatsappWebhookHandlers";
import { verifyMetaWebhookToken, findMetaWebhookTenantsByVerifyToken } from "@/lib/webhookVerify";
import {
  getOrCreateIntegrationWebhook,
  markWebhookEvent,
  markWebhookVerified,
  saveMetaVerifyToken,
  WEBHOOK_PROVIDERS,
} from "@/lib/integrationWebhooks";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode") ?? searchParams.get("hub_mode");
  const token =
    searchParams.get("hub.verify_token") ?? searchParams.get("hub_verify_token");
  const challenge =
    searchParams.get("hub.challenge") ?? searchParams.get("hub_challenge");

  if (mode === "subscribe" && token && (await verifyMetaWebhookToken(token))) {
    const tenantIds = await findMetaWebhookTenantsByVerifyToken(token);
    await Promise.all(
      tenantIds.map(async (tenantId) => {
        await getOrCreateIntegrationWebhook(tenantId, WEBHOOK_PROVIDERS.WHATSAPP_META);
        await saveMetaVerifyToken(tenantId, token);
        await markWebhookVerified(tenantId, WEBHOOK_PROVIDERS.WHATSAPP_META);
      })
    );
    if (!tenantIds.length) {
      console.warn(
        "[meta/webhook] Verification succeeded but no tenant matched verify token"
      );
    }
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const phoneNumberId =
    body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id ?? null;

  const tenantId = await resolveWhatsAppWebhookUserId({ phoneNumberId });
  if (!tenantId) {
    console.warn("[meta/webhook] No tenant resolved for phone_number_id", phoneNumberId);
    return NextResponse.json({ received: true });
  }

  try {
    const processed = await handleMetaWhatsAppWebhook(tenantId, body);
    await markWebhookEvent(tenantId, WEBHOOK_PROVIDERS.WHATSAPP_META);
    const inbound = processed.filter((p) => p.activity === "reply");
    if (inbound.length) {
      console.info(
        "[meta/webhook] Stored inbound message(s)",
        inbound.map((p) => p.commLogId)
      );
    }
    return NextResponse.json({ received: true, processed });
  } catch (err) {
    console.error("[meta/webhook]", err);
    return NextResponse.json({ received: true, error: err.message });
  }
}
