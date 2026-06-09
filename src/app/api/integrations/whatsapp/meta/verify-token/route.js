import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { updateMetaWebhookVerifyToken } from "@/lib/whatsappIntegration";

export async function POST(request) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CHANNEL_INTEGRATE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const webhookVerifyToken = body.webhookVerifyToken?.trim();
  if (!webhookVerifyToken) {
    return NextResponse.json(
      { error: "Webhook verify token is required" },
      { status: 400 }
    );
  }

  try {
    const integration = await updateMetaWebhookVerifyToken(
      ctx.tenantId,
      webhookVerifyToken
    );
    return NextResponse.json({
      message: "Webhook verify token saved",
      integration,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Failed to save verify token" },
      { status: 400 }
    );
  }
}
