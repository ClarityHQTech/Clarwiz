import { NextResponse } from "next/server";
import {
  findWebhookByToken,
  markWebhookEvent,
  tryGetDecryptedSigningSecret,
  WEBHOOK_PROVIDERS,
} from "@/lib/integrationWebhooks";
import {
  handleLinkupWebhookEvent,
  parseLinkupWebhookPayload,
  verifyLinkupSignature,
} from "@/lib/execution/webhookTracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const token = params?.token;
  const rawBody = Buffer.from(await request.arrayBuffer());
  const record = await findWebhookByToken(token);

  if (!record || record.provider !== WEBHOOK_PROVIDERS.LINKUP) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const hasStoredSecret = Boolean(record.encryptedSigningSecret);
  const signingSecret = tryGetDecryptedSigningSecret(record);
  const signature = request.headers.get("x-linkup-signature");
  const timestamp = request.headers.get("x-linkup-timestamp");

  if (hasStoredSecret && !signingSecret) {
    console.error("[linkup webhook] signing secret decrypt failed", {
      tenantId: record.tenantId,
    });
    await markWebhookEvent(record.tenantId, WEBHOOK_PROVIDERS.LINKUP, {
      error: "Signing secret unreadable — use Reconnect webhook in Settings",
    });
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  if (signingSecret) {
    if (!signature || !timestamp) {
      await markWebhookEvent(record.tenantId, WEBHOOK_PROVIDERS.LINKUP, {
        error: "Missing Linkup signature headers",
      });
      return NextResponse.json(
        { error: "Missing Linkup signature headers" },
        { status: 401 }
      );
    }
    if (!verifyLinkupSignature(rawBody, signature, signingSecret, timestamp)) {
      console.warn("[linkup webhook] signature verification failed", {
        tenantId: record.tenantId,
      });
      await markWebhookEvent(record.tenantId, WEBHOOK_PROVIDERS.LINKUP, {
        error: "Invalid webhook signature — use Reconnect webhook in Settings",
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let body;
  try {
    body = JSON.parse(rawBody.toString("utf8"));
  } catch {
    await markWebhookEvent(record.tenantId, WEBHOOK_PROVIDERS.LINKUP, {
      error: "Invalid JSON payload",
    });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { eventType } = parseLinkupWebhookPayload(body);
  console.info("[linkup webhook] received", {
    tenantId: record.tenantId,
    eventType,
    accountId: body?.account_id ?? null,
  });

  const result = await handleLinkupWebhookEvent(record.tenantId, body);
  return NextResponse.json({ received: true, ...result });
}
