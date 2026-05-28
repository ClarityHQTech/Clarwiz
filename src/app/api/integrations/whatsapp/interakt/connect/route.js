import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  connectInteraktWhatsApp,
  serializeWhatsAppIntegration,
} from "@/lib/whatsappIntegration";

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

  const apiKey = body.apiKey?.trim();
  const wabaId = body.wabaId?.trim() || null;
  const metaAccessToken = body.metaAccessToken?.trim() || null;

  if (!apiKey) {
    return NextResponse.json({ error: "Interakt API key is required" }, { status: 400 });
  }

  if (metaAccessToken && !wabaId) {
    return NextResponse.json(
      {
        error:
          "WABA ID is required when providing a Meta access token for template sync",
      },
      { status: 400 }
    );
  }

  try {
    const record = await connectInteraktWhatsApp(ctx.tenantId, {
      apiKey,
      wabaId,
      metaAccessToken,
    });

    return NextResponse.json({
      message: "WhatsApp connected via Interakt",
      integration: serializeWhatsAppIntegration(record),
    });
  } catch (err) {
    if (err.integration) {
      return NextResponse.json({
        message: "Connected to Interakt with warnings",
        warning: err.templatesWarning || err.message,
        integration: serializeWhatsAppIntegration(err.integration),
      });
    }
    return NextResponse.json(
      { error: err.message || "Failed to connect Interakt" },
      { status: 400 }
    );
  }
}
