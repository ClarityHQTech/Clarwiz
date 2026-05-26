import { NextResponse } from "next/server";
import {
  handleMetaWhatsAppWebhook,
  resolveWhatsAppWebhookUserId,
} from "@/lib/execution/whatsappWebhookHandlers";

const VERIFY_TOKEN =
  process.env.WHATSAPP_META_VERIFY_TOKEN?.trim() ||
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && VERIFY_TOKEN && token === VERIFY_TOKEN) {
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

  const userId = await resolveWhatsAppWebhookUserId({ phoneNumberId });
  if (!userId) {
    console.warn("[meta/webhook] No user resolved for phone_number_id", phoneNumberId);
    return NextResponse.json({ received: true });
  }

  try {
    const processed = await handleMetaWhatsAppWebhook(userId, body);
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
