import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  connectMetaWhatsApp,
} from "@/lib/whatsappIntegration";
import { registerWebhooksForTenant } from "@/lib/execution/registerIntegrationWebhooks";

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

  const accessToken = body.accessToken?.trim();
  const phoneNumberId = body.phoneNumberId?.trim();
  const wabaId = body.wabaId?.trim();
  const webhookVerifyToken = body.webhookVerifyToken?.trim();

  if (!accessToken || !phoneNumberId || !wabaId) {
    return NextResponse.json(
      {
        error:
          "Access token, phone number ID, and WhatsApp Business Account ID are required",
      },
      { status: 400 }
    );
  }

  if (!webhookVerifyToken) {
    return NextResponse.json(
      {
        error:
          "Webhook verify token is required (same value as in Meta Developer Console)",
      },
      { status: 400 }
    );
  }

  try {
    const integration = await connectMetaWhatsApp(ctx.tenantId, {
      accessToken,
      phoneNumberId,
      wabaId,
      webhookVerifyToken,
    });

    registerWebhooksForTenant(ctx.tenantId).catch((err) =>
      console.warn("[whatsapp/meta/connect] webhook registration:", err.message)
    );

    return NextResponse.json({
      message: "WhatsApp connected via Meta Cloud API",
      integration,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Failed to connect Meta WhatsApp" },
      { status: 400 }
    );
  }
}
