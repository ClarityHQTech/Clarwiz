import { NextResponse } from "next/server";
import { verifyCalendlyWebhookSignature } from "@/lib/calendlyApi";
import { handleCalendlyWebhookEvent } from "@/lib/execution/handleCalendlyWebhook";

export async function POST(request) {
  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY?.trim();
  const rawBody = await request.text();
  const signature = request.headers.get("Calendly-Webhook-Signature");

  if (signingKey) {
    const valid = verifyCalendlyWebhookSignature(
      rawBody,
      signature,
      signingKey
    );
    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await handleCalendlyWebhookEvent(body);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[calendly webhook]", err);
    return NextResponse.json(
      { error: err.message || "Webhook handler failed" },
      { status: 500 }
    );
  }
}
