import { NextResponse } from "next/server";
import {
  findWebhookByToken,
  WEBHOOK_PROVIDERS,
} from "@/lib/integrationWebhooks";
import { getDecryptedSigningSecret } from "@/lib/integrationWebhooks";
import {
  handleLinkupWebhookEvent,
  verifyLinkupSignature,
} from "@/lib/execution/webhookTracking";

export async function POST(request, { params }) {
  const rawBody = Buffer.from(await request.arrayBuffer());
  const record = await findWebhookByToken(params.token);

  if (!record || record.provider !== WEBHOOK_PROVIDERS.LINKUP) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const signingSecret = getDecryptedSigningSecret(record);
  const signature = request.headers.get("x-linkup-signature");
  const timestamp = request.headers.get("x-linkup-timestamp");

  if (signingSecret) {
    if (!signature || !timestamp) {
      return NextResponse.json(
        { error: "Missing Linkup signature headers" },
        { status: 401 }
      );
    }
    if (!verifyLinkupSignature(rawBody, signature, signingSecret, timestamp)) {
      console.warn("[linkup webhook] signature verification failed", {
        tenantId: record.tenantId,
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let body;
  try {
    body = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await handleLinkupWebhookEvent(record.tenantId, body);
  return NextResponse.json({ received: true, ...result });
}
